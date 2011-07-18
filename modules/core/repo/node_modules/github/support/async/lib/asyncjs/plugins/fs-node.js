/*!
 * async.js
 * Copyright(c) 2010 Fabian Jakobs <fabian.jakobs@web.de>
 * MIT Licensed
 */

var async = require("../async")
var fs = require("fs")
var exec = require('child_process').exec;
var sys = require("sys")
var Path = require("path")

var POSTORDER = 0
var PREORDER = 1

async.plugin({
    stat: function() {
        return this.$unaryOp(fs.stat, "stat")
    },

    lstat: function() {
        return this.$unaryOp(fs.lstat, "stat")
    },

    fstat: function() {
        return this.$unaryOp(fs.fstat, "stat")
    },

    unlink: function() {
        return this.$unaryOp(fs.unlink)
    },

    rmdir: function() {
        return this.$unaryOp(fs.rmdir)
    },

    mkdir: function(mode) {
        return this.$unaryOp(function(path, next) {
            fs.mkdir(path, mode, next)
        })
    },

    realpath: function() {
        return this.$unaryOp(fs.realpath, "resolvedPath")
    },
    
    abspath: function() {
        return this.each(function(file, next) {
            if (!file.path)
                return next("not a file sequence!")

            file.abspath = async.abspath(file.path)
            next()
        })
    },

    open: function(flags, mode) {
        return this.$fileOp(function(file, next) {
            fs.open(file.path, mode || file.mode || "r", flags || file.flags || 0666, next)
        }, "fd")
    },

    close: function() {
        return this.$fileOp(function(file, next) {
            if (!file.fd)
                next(null, file)
            
            var fd = file.fd
            delete file.fd
            
            fs.close(fd, next)
        }, "fd")
    },

    exists: function() {
        return this.$unaryOp(function(path, next) {
            Path.exists(path, function(exists) {
                next(null, exists)
            })
        }, "exists")
    },
    
    chmod: function(mode) {
        return this.$fileOp(function(file, next) {
            fs.chmod(file.path, mode, function(err) {
                if (!err && file.stat)
                    file.stat.mode = mode
                next(err)
            })
        })
    },
    
    chown: function(owner, group, recursive) {
        return this.$fileOp(function(file, next) {
            async.chown(file.path, owner, group, recursive, next)
        })
    },
    
    $unaryOp: function(fn, storeKey) {
        return this.each(function(file, next) {
            if (!file.path)
                return next("not a file sequence!")
                
            fn(file.path, function(err, result) {
                if (err) 
                    return next(err, file)
                if (storeKey)
                    file[storeKey] = result
                next()
            })
        })        
    },
    
    $fileOp: function(fn, storeKey) {
        return this.each(function(file, next) {
            if (!file.path)
                return next("not a file sequence!")
                
            fn(file, function(err, result) {
                if (err) 
                    return next(err, file)
                if (storeKey)
                    file[storeKey] = result
                next()
            })
        })
    },

    readFile : function(encoding) {
        return this.each(function(file, next) {
            if (!file.path)
                return next("not a file sequence!")
            
            if (encoding)
                fs.readFile(file.path, encoding, readCallback)
            else
                fs.readFile(file.path, readCallback)
            
            function readCallback(err, data) {
                if (err) 
                    return next(err)
                file.data = data
                next()
            }            
        })
    },
    
    writeFile : function(data) {
        return this.$fileOp(function(file, next) {
            fs.writeFile(file.path, data || file.data, next)
        })
    }
}, {
    files: function(files, root) {
        root = root || ""
        return async.list(files.map(function(name) {
            var path = root ? Path.join(root, name) : name
            return {
                path: path,
                name: Path.basename(path)
            }
        }))
    },
    
    glob: function(pattern) {
        function fileSort(file1, file2) {
            return file1.stat.isDirectory() + 0 > file2.stat.isDirectory() + 0
        }
        
        // case 1: pattern has no magic
        if (!this.$hasMagic(pattern))
            return async.files([pattern])                
                .exists()
                .filter(function(file) {
                    return file.exists
                })

        // split pattern into non magic head and magic tail
        chunks = pattern.split("/")
        var head = ""
        var aggregate = ""
        for (var i=0; i < chunks.length; i++) {
            var chunk = chunks[i]
            if (this.$hasMagic(chunk))
                break
            else
                head += chunk + "/"
        }
        var tail = chunks.slice(i)
        head = head || "."

        var fileRe = this.$globToRegExp(tail[0])
        function fileFilter(file, next) {
            next(null, file.name.match(fileRe))
        }
        
        var gen
        function next(callback) {
            if (gen)
                return gen.next(callback)
                
            Path.exists(head, function(exists){
                if (!exists)
                    return callback(async.STOP)
            
                // case 1: only the "file" part of the pattern has "magic"
                if (tail.length == 1) {
                    gen = async.readdir(head)
                        .filter(fileFilter)
                        .stat()
                        .sort(fileSort)
                    return gen.next(callback)
                }

                // case 2: a path part contains magic
                else {
                    var files = []
                    var dirs = []
                    async.readdir(head)
                        .filter(fileFilter)
                        .stat()
                        .each(function(file) {
                            if (file.stat.isDirectory())
                                dirs.push(file.name)
                            else 
                                files.push(file.path)
                        })
                        .end(function(err) {
                            if (err)
                                return callback(err)
                            
                            if (!dirs.length && !files.length)
                                return callback(async.STOP)
                            
                            var gens = dirs.map(function(dir) {
                                return async.glob(head + dir + "/" + tail.slice(1).join("/"))
                            })

                            if (files.length)
                                gens.unshift(async.files(files))
                                
                            gen = async.concat.apply(async, gens)

                            return gen.next(callback)                            
                        })
                }
            })
        }
        
        return new async.Generator(next)
    },

    $hasMagic: function(path) {
        return !!path.match(/[\*\?\[\]]/)
    },
    
    $globToRegExp: function(glob) {
        return new RegExp("^" + glob.replace(/\*/g, ".*").replace(/\?/g, ".") + "$")
    },
    
    readdir: function(path) {
        var filesGen
        
        return new async.Generator(function(callback) {
            if (filesGen)
                return filesGen.next(callback)
                
            fs.readdir(path, function(err, files) {
                if (err)
                    return callback(err)
                    
                filesGen = async.files(files, path)
                filesGen.next(callback)
            })
        })
    },
    
    POSTORDER: POSTORDER,
    PREORDER: PREORDER,
    
    walkfiles: function(path, recurse, order) {
        recurse = recurse || function(item, next) { next(null, true) }

        var gen
        var next = function(callback) {
            if (gen)
                return gen.next(callback)

            Path.exists(path, function(exists) {
                if (!exists)
                    return callback(async.STOP)
                    
                var files = []
                var dirs = []

                async.readdir(path)
                    .stat()
                    .filter(recurse)
                    .each(function(file) {
                        if (file.stat.isDirectory())
                            dirs.push(file.path)
                        else 
                            files.push(file.path)
                    }).end(function(err) {
                        if (err)
                            return callback(err)

                        var gens = dirs.map(function(dir) {
                            return async.walkfiles(dir, recurse, order)
                        })
                        
                        if (order == PREORDER)
                            gens.unshift(async.files([path]))                           
                        else
                            files.push(path)
                        
                        gens.push(async.files(files))
                        gen = async.concat.apply(async, gens)

                        gen.next(callback)
                    })
            })
        }
        return new async.Generator(next)
    },
    
    copyfile: function(srcPath, destPath, force, callback) {
        fs.stat(destPath, function(err, stat) {
            if (stat && stat.isDirectory())
                destPath = Path.join(destPath, Path.basename(srcPath))

            if (!force) {
                Path.exists(destPath, function(exists) {
                    if (exists)
                        callback("destination file already exists!")
                    else
                        copy()
                })
            }
            else
                copy()
        })

        function copy() {        
            var reader = fs.createReadStream(srcPath)
            var writer = fs.createWriteStream(destPath)
            sys.pump(reader, writer, callback)
        }
    },

    abspath: function(dir) {
        dir = Path.normalize(dir)
        if (dir.charAt(0) == "/")
            return Path.normalize(dir)
        else if (dir.charAt(0) == "~")
            return Path.normalize(process.env.HOME + dir.slice(1))
        else
            return Path.normalize(Path.join(process.cwd(), dir))
    },

    copytree: function(srcPath, destPath, callback) {
        srcPath = async.abspath(srcPath)
        destPath = async.abspath(destPath)

        if (destPath.indexOf(srcPath) == 0 && destPath.charAt(srcPath.length) == "/")
            return callback("the destination path is inside of the source path")

        Path.exists(destPath, function(exists) {
            if (!exists)
                fs.mkdir(destPath, 0755, walk)
            else
                walk()
        })

        function walk(err) {
            if (err)
                return callback(err)

            async.walkfiles(srcPath, null, async.PREORDER)
                .stat()
                .each(function(file, next) {
                    var relative = file.path.substring(srcPath.length)
                    if (!relative)
                        return next()

                    var dest = Path.join(destPath, relative)
                    if (file.stat.isDirectory())
                        fs.mkdir(dest, file.stat.mode, next)
                    else
                        async.copyfile(file.path, dest, false, next)
                })
                .end(callback)
        }
    },
    
    rmtree: function(path, callback) {
        async.walkfiles(path, null, async.POSTORDER)
            .stat()
            .each(function(file, next) {
                if (file.stat.isDirectory())
                    fs.rmdir(file.path, next)
                else
                    fs.unlink(file.path, next)
            })
            .end(callback)
    },
    
    makePath: function(dirpath, callback) {
        dirpath = Path.normalize(dirpath)
        var currentPath = ""

        async.list(dirpath.split("/"))
            .map(function(dirpath) {
                currentPath += "/" + dirpath
                return {
                    dirpath: currentPath,
                    name   : Path.basename(currentPath)
                }
            })
            .each(function(file, next) {
                fs.stat(file.dirpath, function(err, stat) {
                    if (err && err.errno == 2)
                        fs.mkdir(file.dirpath, 0755, next)
                    else if (err)
                        next(err)
                    else if (!stat.isDirectory())
                        next(async.STOP)
                    else
                        next()
                })
            })
            .end(function(err) {
                callback(err, dirpath);
            });
    },
    
    chown : function(path, owner, group, recursive, callback) {
        var cmd = "chown " + (recursive ? "-R " : " ") + (owner || "") + (group ? ":" + group : "") + " " + path
        exec(cmd, function(err, stdout, stderr) {
            if (err)
                return callback(err + ": " + stdout + "\n" + cmd)
            else
                return callback()
        })
    }
})

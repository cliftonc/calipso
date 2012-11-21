Calipso
-------

Calipso is a simple NodeJS content management system, built along
similar themes to Drupal and Wordpress, that is designed to be fast,
flexible and simple.

For additional details, including installation instructions, please
visit the home page: [http://calip.so/][]

If you would like to contribute, please take a look at the issues list
as this will have the most up to date view of work that needs to be done
for the next minor release. Otherwise, please just pm myself (cliftonc),
dennis (dennishall) or dale (dtan) and we can suggest some places for
you to start.

[![Build Status](https://travis-ci.org/cliftonc/calipso.png)](https://travis-ci.org/cliftonc/calipso)

### Quick Install

If you want to try it out as quickly as possible, please install
MongoDB, ensure that you have the right compilers installed (for OSX,
XCode4 will work, for Ubuntu, the build-essential and libssl-dev
packages) and then use NPM:

        npm install calipso -g
        calipso site /var/www/MySite
        cd /var/www/MySite
        calipso server

#### Using node v0.5.3 and later

Since node v0.5.3 has removed <code>require.paths</code>, in order to
<code>require(‘lib/calipso’)</code>, you must include the following to
your file:

        var rootpath = process.cwd() + '/',
          path = require('path'),
          calipso = require(path.join(rootpath, 'lib/calipso'));

    That also goes for including anything that is based on the root path of the project directory.

### Development Steps

    To get running in development mode (not the site mode outlined on the front page) - e.g. so you can make changes to core and submit pull requests:

    1.  Fork the repository
    2.  Clone from your fork (replace YOURNAME!): git clone git@github.com:YOURNAME/calipso.git
    3.  Run 'npm install -d' in the clone folder to install all of the dependencies.
    4.  Run 'node app' to run Calipso from the source folder.

    Note that the bin/calipso command line script is really designed to allow people who just want to use Calipso to build sites to use it, it isn't used in the dev process.  As always, any questions please do shout.

### Calipso Command Line Client

    The commands currently supported from the command line client are:

#### Commands That Run Anywhere

        calipso                            : Show this help file.
        calipso site <name|folder>         : Create site in folder.


#### Commands That Run In Site Folder

The most important of these at the moment is ‘modules check’ (this will
ensure that all modules have all of their dependencies installed via
npm), and should be run on site install.

        calipso install                    : Re-run site install.

        calipso cluster --port=3000        : Run as cluster.
        calipso server --port=3000         : Run as a single server.

        calipso modules list               : List installed modules.
        calipso modules check              : Check installation of all modules.
        calipso modules install *mod@ver   : Install module@version, or reinstall module.
        calipso modules download github    : Download module from github (e.g. cliftonc/calipso-elastic)
        calipso modules enable *mod        : Enable module.
        calipso modules disable *mod       : Disable module.

        calipso themes list                : List installed themes.
        calipso themes uninstall *theme    : Remove theme (delete from disk)
        calipso themes download *url       : Download (url: http://, gh: cliftonc/calipso-site-theme, repo: calipso-site).

### Contributors

 \* [Clifton Cunningham][]  
 \* [Andreas Richter][]   
 \* [Dennis Hall][]  
 \* [Cole Gillespie][]  
 \* [Jonathan Zacsh][]  
 \* [Jerad Bitner][]  
 \* [Martin Moen][]  
 \* [dale tan][]  
 \* [Nate Hunzaker][]  

  [http://calip.so/]: http://calip.so/?utm_source=github&utm_medium=calipso&utm_campaign=github
  [http://travis-ci.org/cliftonc/calipso]: http://travis-ci.org/cliftonc/calipso
  [Clifton Cunningham]: https://github.com/cliftonc
  [Dennis Hall]: https://github.com/dennishall
  [Cole Gillespie]: https://github.com/coleGillespie
  [Jonathan Zacsh]: https://github.com/jzacsh
  [Jerad Bitner]: https://github.com/sirkitree
  [Martin Moen]: https://github.com/botto
  [dale tan]: https://github.com/dtan
  [Nate Hunzaker]: https://github.com/nhunzaker
  [Andreas Richter]: https://github.com/richtera

#MIT License

Copyright (c) 

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWAR
var ncms = require("../../lib/ncms"), cron = require('./scheduler.cron');      

exports = module.exports = {init: init, route: route, reload: reload, disable: disable};
/**
 * Base news module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      
      
      /** 
       * Menu items
       */
      res.menu.primary.push({name:'Scheduler',url:'/scheduler',regexp:/scheduler/});                     
  
      /**
       * Routes
       */      
      module.router.route(req,res,next);
      
};

function init(module,app,next) {      

  ncms.lib.step(
      function defineRoutes() {
        module.router.addRoute('GET /scheduler',schedulerAdmin,{templatePath:__dirname + '/templates/admin.html',admin:true},this.parallel());  
        module.router.addRoute('POST /scheduler',createJob,{admin:true},this.parallel());    
        module.router.addRoute('GET /scheduler/new',createJobForm,{admin:true,templatePath:__dirname + '/templates/form.html'},this.parallel());
        module.router.addRoute('GET /scheduler/switch/:onoff.:format?',enableScheduler,{admin:true},this.parallel());
        module.router.addRoute('GET /scheduler/switch/:onoff/:jobName.:format?',enableScheduler,{admin:true},this.parallel());
        module.router.addRoute('GET /scheduler/show/:jobName',showJob,{admin:true,templatePath:__dirname + '/templates/show.html'},this.parallel());
        module.router.addRoute('GET /scheduler/edit/:jobName',editJobForm,{admin:true,templatePath:__dirname + '/templates/form.html'},this.parallel());
        module.router.addRoute('GET /scheduler/delete/:jobName',deleteJob,{admin:true},this.parallel());
        module.router.addRoute('POST /scheduler/:jobName',updateJob,{admin:true},this.parallel());
      },
      function done() {
        
        // Ensure we have the job schema defined
        var ScheduledJob = new ncms.lib.mongoose.Schema({
          name:{type: String, required: true, unique: true},
          cronTime:{type: String, default:'* * * * * *',required: true},
          enabled:{type: Boolean, default:false, required: true},
          module:{type: String, default:'', required: true},
          method:{type: String, default:'', required: true},
          args:{type: String, default:'', required: false},
          created: { type: Date, default: Date.now }          
        });
        ncms.lib.mongoose.model('ScheduledJob', ScheduledJob);  
                
        loadJobs(next);
        
        ncms.data.jobFunctions = [];
        
        for(var module in ncms.modules) {                    
          for(var job in ncms.modules[module].fn.jobs) {
              ncms.data.jobFunctions.push(module + "." + job);
          }          
        }                                
        
      }        
  );
  
};

function loadJobs(next) {
  
  var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob');      

  // Check to see if we already have any jobs.
  // Create a holder for our jobs - DOES THIS STOP EVERYTHING ELSE??!
  ncms.jobs = {};
            
  ScheduledJob.find({}, function(err, jobs) {
        
        jobs.forEach(function(job) {          
          // '* * * * * *'
          if(ncms.modules[job.module] && ncms.modules[job.module].fn.jobs[job.method]) {
            

            var options = {
                jobName: job.name,
                cronTime: job.cronTime, 
                enabled: job.enabled, 
                module: job.module, 
                method: job.method, 
                fn: ncms.modules[job.module].fn.jobs[job.method],
                args: job.args
            }
            
            ncms.jobs[job.name] = new cron.CronJob(options);           
          } else {            
            
            var options = {
                jobName: job.name,
                cronTime: job.cronTime, 
                enabled: job.enabled, 
                module: job.module, 
                method: job.method, 
                fn: function() { ncms.error("Invalid function " + job.module 
                                + "." + job.method + " for job: " + job.name)},
                args: job.args
            }
            ncms.jobs[job.name] = new cron.CronJob(options);
            ncms.jobs[job.name].invalid = true;
          }
          
        });
        
        next();
  });
  
}

/**
 * Quick API to turn jobs on and off.
 * 
 * @param req
 * @param res
 * @param next
 * @param template
 */
function enableScheduler(req,res,next,template) {      

    // TODO : THIS DOESN@T ACTUALLY UPDATE THE DATABASE AND SO IS NOT STORED!
  
    var jobName = req.moduleParams.jobName;
    var format = req.moduleParams.format;
    
    if(jobName) {
      
      if(!ncms.jobs[jobName]) {
        
        if(format === 'json') {
          res.send({status:'error',msg:'Could not locate job: ' + jobName});
        } else {
          req.flash('error','Could not locate job: ' + jobName);
          res.redirect("/scheduler");            
        }
        return;
      }
      
      if(req.moduleParams.onoff === 'on') {
        ncms.jobs[jobName].enable();
      } else {
        ncms.jobs[jobName].disable();
      }
      
    } else {
      
      for(var job in ncms.jobs) {
        if(req.moduleParams.onoff === 'on') {
            ncms.jobs[job].enable();  
        } else {
            ncms.jobs[job].disable();
        }      
      }
      
    }
    
    if(format === 'json') {
      res.send({status:'ok'});
    } else {
      res.redirect("/scheduler");  
    }
    
    
};

function schedulerAdmin(req,res,next,template) {      
      
 
    res.menu.secondary.push({name:'New Job',parentUrl:'/scheduler',url:'/scheduler/new'});
    res.menu.secondary.push({name:'Enable All',parentUrl:'/scheduler',url:'/scheduler/switch/on'});
    res.menu.secondary.push({name:'Disable All',parentUrl:'/scheduler',url:'/scheduler/switch/off'});
  
    
    var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob'); 
    
    // Render json to blocks
    var item = {id:"NA",type:'content',meta:{jobs:ncms.jobs}};                
    res.blocks.body.push(item);
    
    // Render template
    if(template) {
      res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
    }
    next();
    
};


function createJobForm(req,res,next,template) {
 
  res.menu.secondary.push({name:'New Job',parentUrl:'/scheduler',url:'/scheduler/new'});

  var item = {id:'FORM',title:'Form',type:'form',method:'POST',action:'/scheduler',fields:[                                                                                                         
                 {label:'Name',name:'job[name]',type:'text',value:''},                 
                 {label:'CRON Time',type:'cronTime',value:''},                 
                 {label:'Enabled',name:'job[enabled]',type:'select',value:'no',options:["yes","no"]},
                 {label:'Job Function',name:'job[moduleMethod]',type:'select',value:'',options:ncms.data.jobFunctions},
                 {label:'Arguments',name:'job[args]',type:'textarea',value:""}
              ]}
  
  res.blocks.body.push(item);
  if(template) {
    res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
  }                      
  
  next();
}

/**
 * Module specific functions
 * 
 * @param req
 * @param res
 * @param next
 */
function createJob(req,res,next,template) {
                  
      var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob');                        
      var job = processForm(req.body.job,new ScheduledJob(req.body.job));      
      
      job.save(function(err) {    
        if(err) {
          req.flash('error','Could not save content: ' + err.message);
          if(res.statusCode != 302) {
            res.redirect('back');  
          }                          
        } else {
          
          if(ncms.modules[job.module] && ncms.modules[job.module].fn.jobs[job.method]) {
            
            var options = {
                jobName: job.name,
                cronTime: job.cronTime, 
                enabled: job.enabled, 
                module: job.module, 
                method: job.method, 
                fn: ncms.modules[job.module].fn.jobs[job.method],
                args: job.args
            }
            
            ncms.jobs[job.name] = new cron.CronJob(options);
            
          } else {
            req.flash('error',"Module: " + job.module + ', Method: ' + job.method + " does not exist, job not initialised.");
          }
          
          res.redirect('/scheduler');
        }
        // If not already redirecting, then redirect
        next();
      });       
  
}

function processForm(formObject,job) {

  //Name - strip out any spaces
  job.name = formObject.name.replace(/\s/,"");
  job.args = formObject.args;
  
  // Enabled
  if(formObject.enabled === 'yes') {
    job.enabled = true;
  } else {
    job.enabled = false;
  }
  
  // Module method splitter
  job.module = formObject.moduleMethod.split(".")[0];
  job.method = formObject.moduleMethod.split(".")[1];
  
  // Cron time builder
  job.cronTime = formObject.cronTime0 + " "
                 + formObject.cronTime1 + " "
                 + formObject.cronTime2 + " "
                 + formObject.cronTime3 + " "
                 + formObject.cronTime4 + " "
                 + formObject.cronTime5
   
  return job;
                 
}

function editJobForm(req,res,next,template) {
  
  var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob');      

  var jobName = req.moduleParams.jobName;          
  var item;
  
  res.menu.secondary.push({name:'New Job',parentUrl:'/scheduler',url:'/scheduler/new'});
  res.menu.secondary.push({name:'Edit Job',parentUrl:'/scheduler',url:'/scheduler/edit/' + jobName});
   
  ScheduledJob.findOne({name:jobName}, function(err, job) {
    
    if(err || job === null) {
      item = {id:'ERROR',title:"Not Found!",type:'job',content:"Sorry, I couldn't find that job!"};      
    } else {      
      
      item = {id:job._id,title:"Job: " + job.name,type:'form',method:'POST',action:'/scheduler/' + job.name,fields:[                                                                         
                 {label:'Name',name:'job[name]',type:'text',value:job.name},                 
                 {label:'CRON Time',type:'cronTime',value:job.cronTime},                 
                 {label:'Enabled',name:'job[enabled]',type:'select',value: job.enabled ? "yes" : "no",options:["yes","no"]},
                 {label:'Job Function',name:'job[moduleMethod]',type:'select',value:job.module + "." + job.method,options:ncms.data.jobFunctions},
                 {label:'Arguments',name:'job[args]',type:'textarea',value:job.args}                
           ]};
        
    }           
    
    res.blocks.body.push(item);
    if(template) {
      res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
    }                    
    next();   
    
  });
  
}

function updateJob(req,res,next,template) {
      
  var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob');        
  var jobName = req.moduleParams.jobName;          
  
  ScheduledJob.findOne({name:jobName}, function(err, job) {
    if (job) {      
        
      var job = processForm(req.body.job,job);
      
      job.save(function(err) {
          if(err) {
            req.flash('error','Could not update job: ' + err.message);
            if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
              res.redirect('/scheduler/edit/' + job.name);
            }
          } else {
            
            if(jobName != job.name) {
              ncms.jobs[job.name] = ncms.jobs[jobName];   // Copy it
              delete ncms.jobs[jobName];                  // 'Delete' it - GC will get it later ???
            }
            
            if(ncms.modules[job.module] && ncms.modules[job.module].fn.jobs[job.method]) {

              var options = {
                  jobName: job.name,
                  cronTime: job.cronTime, 
                  enabled: job.enabled, 
                  module: job.module, 
                  method: job.method, 
                  fn: ncms.modules[job.module].fn.jobs[job.method],
                  args: job.args
              }
              
              ncms.jobs[job.name].configure(options);
              
            } else {
              req.flash('error',"Module: " + job.module + ', Method: ' + job.method + " does not exist, job modified but not initialised.");
            }
            
            res.redirect('/scheduler/show/' + job.name);
            
          }
          next();         
        });
        
    } else {
      req.flash('error','Could not locate job!');
      res.redirect('/scheduler');
      next();
    }
  });
  
}


function showJob(req,res,next,template,err) {
     
  var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob');      

  var jobName = req.moduleParams.jobName;          
  var item;
  
  res.menu.secondary.push({name:'New Job',parentUrl:'/scheduler',url:'/scheduler/new'});
  res.menu.secondary.push({name:'Edit Job',parentUrl:'/scheduler',url:'/scheduler/edit/' + jobName});
  res.menu.secondary.push({name:'Delete Job',parentUrl:'/scheduler',url:'/scheduler/delete/' + jobName});
   
  ScheduledJob.findOne({name:jobName}, function(err, job) {
    
    if(err || job === null) {
      res.redirect("/scheduler");
      next();
      return;     
    } else {             
        item = {id:job._id,type:'job',meta:job.toObject()};                
    }   
      
    res.blocks.body.push(item);
    if(template) {
      res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
    }                
  
    next();
    
  });
  
}


function deleteJob(req,res,next,template,err) {
  
  var ScheduledJob = ncms.lib.mongoose.model('ScheduledJob');        
  var jobName = req.moduleParams.jobName;          
  
  ScheduledJob.remove({name:jobName}, function(err) {
    if(err) {      
      req.flash("info","Unable to delete the job: " + jobName + " because " + err.message);
      res.redirect("/scheduler");
    } else {
      ncms.jobs[jobName].disable() // Disable it
      delete ncms.jobs[jobName];   // 'Delete' it - GC will get it later ???
      req.flash("info","Job: " + jobName + " has now been deleted.");      
      res.redirect("/scheduler");      
    }
    next();
  });
   
}

// Disable - same as reload
function disable() {
  reload();
}

// Reload
function reload() {

  // As the cron jobs are background tasks, we need to delete them all from the ncms object 
  for(var jobName in ncms.jobs) {
    ncms.jobs[jobName].disable() // Disable it
    delete ncms.jobs[jobName];   // 'Delete' it - GC will get it later ???
  }
    
}
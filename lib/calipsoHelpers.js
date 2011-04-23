/**
 *  Dynamic helpers for insertion into the templating engine 
 *  They all need to take in a req,res pair, these are then
 *  interpreted during the request stack and passed into the 
 *  view engine (so for example 'request' is accessible).
 *  
 */

exports = module.exports = {
    /**
     * Request shortcut
     */
    request: function(req,res){        
      return req;        
    },    
    /**
     * User shortcut
     */
    user: function(req,res){        
        var user;      
        if(req.session && req.session.user) {
          user = req.session.user;            
        } else {
          user = {username:'',anonymous:true};
        }
        return user;        
    },
    prettyDate: function(req,res,calipso) {
            
      var prettyFn = calipso.lib.prettyDate.prettyDate;           
      return prettyFn;
      
    },
    /** 
     * Flash message helper
     */
    hasMessages: function(req,res) {
       return Object.keys(req.flash() || {}).length;
    },    
    messages: function(req,res){
       return function() {
         var msgs = req.flash();
         return Object.keys(msgs).reduce(function(arr, type){
           return arr.concat(msgs[type]);
         }, []);        
       }
     }
     
}

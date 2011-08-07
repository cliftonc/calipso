/**
 * Additional content section / block functions for body.
 */

var calipso = require("lib/calipso"), Query = require("mongoose").Query;

exports = module.exports = function(req,options,callback) {

  /**
   *  Get additional content for blocks in the template
   */
  calipso.lib.step(
    function getContentList() {

      // Create a query and retrieve the content, has pager support, using req.moduleParams
      // But you can override on an individual query by setting in the options (second param)
      var query;
      if(options.user.isAdmin) {
        query = new Query({'tags':req.res.params.tag});
      } else {
        query = new Query({'tags':req.res.params.tag, 'status':'published'});
      }
      options.getContentList(query,{req:req,sortBy:'published,desc',pager:false},this.parallel());

    },
    function done(err, output) {

      callback(err,{ contents:output.contents, pager:output.pager });

    }
  );

}
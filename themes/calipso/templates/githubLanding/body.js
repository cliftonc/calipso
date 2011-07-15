/**
 * Additional content section / block functions for body.
 */

var calipso = require("lib/calipso"),
    Query = require("mongoose").Query;

exports = module.exports = function(req, options, callback) {

  /**
   *  Get additional content for blocks in the template
   */
  calipso.lib.step(

  function getContentList() {

    options.getContent(req, 'github-header-text', this.parallel());

    // Create a query and retrieve the content, has pager support, using req.moduleParams
    // But you can override on an individual query by setting in the options (second param)
    var query = new Query({
      'contentType': 'Github Feed'
    });
    
    options.getContentList(query, {
      req: req,
      sortBy: 'published,desc',      
      limit: 30      
    }, this.parallel());

  }, function done(err, header, output) {

    callback(err,{
      header: header,
      contents: output.contents,
      pager: output.pager
    });

  });

}
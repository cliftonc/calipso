/*!
 * cleanslate core
 *
 * currently covers:
 *  - tabs
 *  - sortable tables (just updates the querystring for server-side sorting)
 *
 */
cleanslate = {
  log : function(){
    try {
      console.log.apply(window, arguments);
    } catch(e) {
      cleanslate.backlog.push(arguments);
    }
  },
  backlog : [],
  init: function(){
    
    // TABS
    // introduced for admin form tabs, but general-purpose enough to belong here.
    $(".tab-content").hide().eq(0).show();
    $(".tab-content h3").remove();
    $("ul.tabs li:first").addClass("active");
    $("ul.tabs a").click(function() {
      var tab = $(this);
      var href = tab.attr('href');
      cleanslate.log(href);
      tab.closest('ul').find('li').removeClass("active");
      tab.parent().addClass("active");
      $(".tab-content").hide();
      $(href).fadeIn(200);
      return false;
    });
    
    // TABLES
    $("th.sortable").click(function() {
      
      var name = $(this).attr('name');
      
      // Consider the current URL
      var baseUrl = location.protocol + '//' + location.host + location.pathname;
      var params = location.search ? location.search.substring(1).split('&') : [];
      
      // Update the params
      var found = false;
      var newParams = [];
      $.each(params, function(i, param) {
        if(param.indexOf('sortBy='+name+',')===0){
          found = true;
          var paramSplit = param.split(',');
          // asc->desc (and implicitly, desc->none, by not pushing it to the newParams)
          if(paramSplit[1] == 'asc'){
            newParams.push(paramSplit[0] + ',desc');
          }
        } else {
          newParams.push(param);
        }
      });
      
      // New (none->asc)
      if(!found) {
        newParams.push('sortBy=' + name + ',asc');
      }
      
      var newSearch = newParams.join('&');
      
      location = baseUrl + (newSearch ? '?'+newSearch : '') + location.hash;
      
    });
    
  } // end of cleanslate.init
  
}; //end of cleanslate

// onDomReady, call cleanslate.init 
$(cleanslate.init);
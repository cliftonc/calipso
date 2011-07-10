/*!
 * cleanslate core
 *
 * javascript module loader
 *
 */
cleanslate = {
  log : function(){
    try {
      console.log.apply('',arguments);
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
        
        var col = $(this);
        
        var sorted = col.hasClass('sorted-asc') ? 'asc' : (col.hasClass('sorted-desc') ? 'desc' : 'none');
        var newSorted = 'asc';
        
        switch(sorted) {
          case('asc'):
            newSorted = 'desc';
            break;
          case('desc'):
            newSorted = 'none';
            break;
          case('none'):
            newSorted = 'asc';
            break;
        }
        
        // Consider the current URL
        var loc = window.location.toString();
        var baseUrl = loc.split("?")[0];        
        var params = (loc.split("?").length > 1) ? loc.split("?")[1].split("&") : [];        
        
        // New url   
        var sortQueryBase = "sortBy=" + col.attr('name') + ",";        
        var update = sortQueryBase + newSorted;
        
        // Check if it is already in the url
        var checkRegex = new RegExp(sortQueryBase.replace("[","\\[").replace("]","\\]"),"g");
        var updateRegex = new RegExp((sortQueryBase + sorted).replace("[","\\[").replace("]","\\]"),"g");

        // Update the params
        var matched = false;  
        var newParams = [];
        params.forEach(function(param,key) {        
          if(param.match(checkRegex)) {
            matched = true;
            if(newSorted === 'none') {
              // Nothing              
            } else {
              newParams.push(param.replace(updateRegex,update));              
            }
          } else {
            newParams.push(param);
          }          
        });
        
        // New
        if(!matched) {
          newParams.push(sortQueryBase + newSorted);
        }
              
        // 
        var url = baseUrl;          
        newParams.forEach(function(param,key) {          
          if(key === 0) {
            url += "?";
          } else {
            url += "&";
          };
          url+= param;          
        });
        
        window.location = url;
        
        
        
    });
    
  } // end of cleanslate.init
  
}; //end of cleanslate

// onDomReady, call cleanslate.init 
$(cleanslate.init);
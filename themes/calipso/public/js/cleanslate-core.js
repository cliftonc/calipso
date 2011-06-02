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
    
  } // end of cleanslate.init
  
}; //end of cleanslate

// onDomReady, call cleanslate.init 
$(cleanslate.init);
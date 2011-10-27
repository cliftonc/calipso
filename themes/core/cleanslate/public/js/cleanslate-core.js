/*!
 * cleanslate core
 *
 * currently covers:
 *  - tabs (open tab is bookmarkable, can't be used with other things that rely on hash)
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
    
    // HIDE/SHOW USER LOGIN FORM
    (function doUsername(){
      var userDataString = $.cookie('userData') || localStorage.user || '{}';
      var user = JSON.parse(decodeURIComponent(userDataString == 'undefined' ? '{}' : userDataString));
      var userWelcomeOrLoginBox = $('#user-welcome-or-login');
      if(user.username){
        // logged in
        userWelcomeOrLoginBox.html(
          '<a href="/user">'+user.username+'</a> | '+
          // we could get fancy and check whether the first letter of the username is uppercase
          // and if so, make "Log Out" uppercase to match.
          '<a href="/user/logout?returnto='+location.href+'">log out</a>'
        );
        
        //if($.cookie('pendingUserAction')){
          //
        //}
        
      } else {
        // not logged in
        userWelcomeOrLoginBox.find('a').eq(0).click(function(e){
          // if the 'plain layout' module is active, then prevent default and get the login form via ajax
          e.preventDefault();
          var el = $(this);
          var userLoginBox = $('#user-login');
          if(!userLoginBox.length){
            $.get(el.attr('href'), function(text){
              var start = '<!--PAGE_BODY_START-->';
              var end = '<!--PAGE_BODY_END-->';
              if(text.length && text.indexOf(start)>-1 && text.indexOf(end)>-1){
                var html = '<div class="close">close</div>' + text.split(start)[1].split(end)[0];
                userLoginBox = $('<div id="user-login"/>').html(html).appendTo(userWelcomeOrLoginBox).show();
                userLoginBox.find('input')[0].focus();
                userWelcomeOrLoginBox.find('.close').click(function(){
                  userLoginBox.toggle();
                });
              }
            });
          } else {
            userLoginBox.toggle();
            userLoginBox.find('input')[0].focus();
          }
        });
      }
    })();
    
    
    // FLASH MESSAGING
    (function doFlashMessage(){
      var msg = $.cookie('flashMessage');
      if(msg){
        // show the message
        $('#messages').html(msg);
        // make sure we see the message.
        setTimeout(function(){ $(window).scrollTop(0); }, 500);
        // clear the message - todo: this does not clear the cookie value!
        $.cookie('flashMessage', null);
      }
    })();
    
    
    // TABS
    // introduced for admin form tabs, but general-purpose enough to belong here.
    (function doTabs(){
      var tabIndex = 0;
      if(/#tab=/.test(location.hash)){
        var hashTabIndex = $('.tab-content').index( $(location.hash.replace('tab=',''))[0] );
        if(hashTabIndex > 0){
          tabIndex = hashTabIndex;
        }
      }
      $(".tab-content").hide().eq(tabIndex).show();
      $("ul.tabs li").eq(tabIndex).addClass("active");
      $(".tab-content h3").remove();
      $("ul.tabs a").click(function(e){
        e.preventDefault();
        var tab = $(this);
        var href = tab.attr('href');
        tab.closest('ul').find('li').removeClass("active");
        tab.parent().addClass("active");
        $(".tab-content").hide();
        $(href).fadeIn(200);
        location.hash = '#tab=' + href.split('#')[1];
      });
    })();
    
    
    // TABLES
    $("th.sortable").click(function() {
      
      var name = $(this).attr('name');
      
      // Consider the current URL
      var l = location;
      var baseUrl = l.protocol + '//' + l.hostname + ':' + l.port + l.pathname;
      var params = l.search ? l.search.substring(1).split('&') : [];
      
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
      
      location = baseUrl + (newSearch ? '?'+newSearch : '') + l.hash;
      
    });
    
    
    // DOUBLE CLICK TO EDIT CONTENT
    // todo - should check if user.isAdmin, or if the user is the author of the content
    $('.content-block').dblclick(function() {
      var id = this.id, l = location;
      if(id) {
        l.href = "/content/edit/" + id + "?returnTo=" + l.pathname + l.search + l.hash;
      }
    });
    
    
    // REMOVE ANNOYING TITLE TOOLTIPS FROM MENUS
    $('.menu a').each(function(i, node) {
      node.title = "";
    });
    
    
  } // end of cleanslate.init
  
}; //end of cleanslate

// since the script block is after all content, call cleanslate.init now
cleanslate.init();

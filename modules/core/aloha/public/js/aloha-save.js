Aloha.ready(function() {
	Aloha.require( ['aloha', 'aloha/jquery'], function( Aloha, jQuery) {
		
		// save all changes after leaving an editable
		Aloha.bind('aloha-editable-deactivated', function(){
			var content = Aloha.activeEditable.getContents();
			var contentId = Aloha.activeEditable.obj[0].id;
			var pageId = window.location.pathname;
			
			// textarea handling -- html id is "xy" and will be "xy-aloha" for the aloha editable
			if ( contentId.match(/-aloha$/gi) ) {
				contentId = contentId.replace( /-aloha/gi, '' );
			}
	
			alohaSave = function (formData) {
				var request = jQuery.ajax({
					url: "content/" + contentId,
					type: "POST",
					data: formData,
					dataType: "html"
				});
	 
				request.done(function( msg ) {
					// Using the built in form handler, so msg contains unfiltered reponse
				});
	 
				request.error(function(jqXHR, textStatus) {
					alert( "Request failed: " + textStatus );
				});
			};

			var request = jQuery.ajax({
				url: "content/edit/" + contentId,
				type: "GET",
			});

			request.done(function( msg ) {
				var formData;
				var $msg = jQuery(msg);
				$msg.find('textarea[name="content[content]"]').text(content);
				formData = $msg.find('#content-form').serializeArray();
				alohaSave(formData);
			});
		});
	});
});

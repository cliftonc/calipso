/*
* Aloha Editor
* Author & Copyright (c) 2010 Gentics Software GmbH
* aloha-sales@gentics.com
* Licensed unter the terms of http://www.aloha-editor.com/license.html
*/
GENTICS.Aloha.LinkChecker=new GENTICS.Aloha.Plugin("com.gentics.aloha.plugins.LinkChecker");GENTICS.Aloha.LinkChecker.languages=["en"];GENTICS.Aloha.LinkChecker.errorCodes=[400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,500,501,502,503,504,505,506];GENTICS.Aloha.LinkChecker.warningCodes=[404,411,412,413,500,503,504,505];GENTICS.Aloha.LinkChecker.init=function(){this.proxyUrl=null;if(GENTICS.Aloha.LinkChecker.settings.proxyUrl!=undefined){this.proxyUrl=GENTICS.Aloha.LinkChecker.settings.proxyUrl}this.timer={};this.xhr={};var that=this;GENTICS.Aloha.EventRegistry.subscribe(GENTICS.Aloha,"editableActivated",function(jEvent,aEvent){aEvent.editable.obj.find("a").each(function(){that.checkLink(this,jQuery(this).attr("href"),0)})});GENTICS.Aloha.EventRegistry.subscribe(GENTICS.Aloha,"editableDeactivated",function(jEvent,aEvent){that.makeClean(aEvent.editable.obj)});GENTICS.Aloha.EventRegistry.subscribe(GENTICS.Aloha,"hrefChanged",function(jEvent,aEvent){that.checkLink(aEvent.obj,"hrefChanged")})};GENTICS.Aloha.LinkChecker.checkLink=function(obj,scope,delay,timeout){var that=this;var url=jQuery(obj).attr("href");var cleanUrl=url;if(typeof url=="string"&&!/^http/.test(url.toLowerCase())){this.makeCleanLink(obj);return}if(this.proxyUrl){url=this.proxyUrl+url}if(this.xhr[scope]){this.xhr[scope].abort();this.xhr[scope]=undefined}this.timer[scope]=this.urlExists(url,function(xhr){that.makeCleanLink(obj)},function(xhr){if(obj){if(jQuery.inArray(xhr.status,that.errorCodes)>=0){var e=xhr.status}else{var e="0"}var o=jQuery(obj);if(o.attr("title")&&!o.attr("data-invalid")){o.attr("data-title",o.attr("title"))}o.attr("data-invalid","true");o.attr("title",cleanUrl+". "+that.i18n("error."+e));if(jQuery.inArray(xhr.status,that.warningCodes)>=0){o.addClass("GENTICS_link_warn")}else{o.addClass("GENTICS_link_error")}}},scope,timeout,delay)};GENTICS.Aloha.LinkChecker.urlExists=function(url,successFunc,failureFunc,scope,timeout,delay){var that=this;clearTimeout(this.timer[scope]);delay=(delay!=null&&delay!=undefined)?delay:700;var newTimer=setTimeout(function(){that.xhr[scope]=jQuery.ajax({url:url,timeout:timeout?10000:timeout,type:"HEAD",complete:function(xhr){clearTimeout(newTimer);try{if(xhr.status<400){successFunc.call(this,xhr)}else{failureFunc.call(this,xhr)}}catch(e){failureFunc.call(this,{status:0})}}})},delay);return newTimer};GENTICS.Aloha.LinkChecker.makeCleanLink=function(obj){if(obj){var o=jQuery(obj);if(o.attr("data-title")){o.attr("title",o.attr("data-title"))}else{o.removeAttr("title")}o.removeAttr("data-title");o.removeAttr("data-invalid");o.removeClass("GENTICS_link_error");o.removeClass("GENTICS_link_warn")}};GENTICS.Aloha.LinkChecker.makeClean=function(editable){var that=this;editable.find("a").each(function(){that.makeCleanLink(this)})};GENTICS.Aloha.LinkChecker.urlencode=function(str){str=(str+"").toString();return encodeURIComponent(str).replace(/!/g,"%21").replace(/'/g,"%27").replace(/\(/g,"%28").replace(/\)/g,"%29").replace(/\*/g,"%2A").replace(/%20/g,"+")};
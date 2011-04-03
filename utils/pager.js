
/**
 * Simple pager - couldn't find one for Express that worked for me.
 */
exports.version = '0.0.1';
exports.render = function(skip,limit,total,path){

	var totalPages = Math.ceil(total/limit) + 1;
	var currentPage = skip/limit + 1;
	var result = "", start, finish;
	var selectedClass = 'page-selected';
	var visiblePages = 5;
	
	// Remember how many we have
	var totalPageLinks = 0;
	
	result += pageSpan(currentPage);
		
	var additionalForward = currentPage < visiblePages ? visiblePages - currentPage : 0;	
	for(i=currentPage + 1; (i < currentPage + visiblePages + additionalForward) && (i < totalPages); i++) {
		start = (i-1)*limit + 1;
		result += pageLink(path,start,limit,i); 		
	}
	
	if(currentPage < totalPages - 1) {
		result +=pageLink(path,skip + limit + 1,limit,">"); 				
		var lastPageStart = (totalPages-2)*limit + 1;
		result +=pageLink(path,lastPageStart,limit,">>"); 		
	}
	
	var additionalBackward = (totalPages - currentPage) < visiblePages ? visiblePages - (totalPages - currentPage) : 0;
	for(i=currentPage - 1; (i > currentPage - visiblePages - additionalBackward) && (i > 0); i--) {
		start = (i-1)*limit + 1;		
		
		result = pageLink(path,start,limit,i) + result;
	}
	
	if(currentPage > 1) {
		result = pageLink(path,(skip - limit + 1),limit,"<") + result;
		result = pageLink(path,1,limit,"<<") + result;			
	}
	
	result += "&nbsp;Go To: <input id='pagerGoto' type='text' name='skip' value='' class='pager-page' title='Go to a specific start point, type and enter ...' />";
	
	result += "<span style='float: right'>" + (skip + 1) + " to " + (skip + limit) + " of " + (total) + "</span>";		
	
	return result
	
}

function pageLink(path,skip,limit,page) {
	return "<a class='pager-page' href='" + path + "/" + skip + "-" + limit + "'>" + page + "</a>";
}

function pageSpan(page) {
	return "<span class='pager-page'>" + page + "</span>";
}

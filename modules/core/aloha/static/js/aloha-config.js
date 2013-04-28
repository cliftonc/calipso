var Aloha = window.Aloha || ( window.Aloha = {} );

Aloha.settings = {
	locale: 'en',
	plugins: {
		format: {
			config : [ 'b', 'i','u','del','sub','sup', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'],
				editables : {
					".content-block" : [ 'b', 'i','u','del','sub','sup', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'],
				}
		},
		image: {
			config : [ 'img' ],
			editables : {
				".content-block" : [ 'img' ]
			}
		}
	},
	sidebar: {
		disabled: true
	}
};

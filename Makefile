
REPORTER = spec

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER)

test-cov: lib-cov
	  @CALIPSO_COV=1 $(MAKE) test REPORTER=html-cov > docs/coverage.html

lib-cov: 
	 @jscoverage lib lib-cov

site:
	rm -fr /tmp/docs \
	&& cp -fr docs /tmp/docs \
	&& git checkout gh-pages \
  	&& cp -fr /tmp/docs/* . \
    && echo "Pages updated ..."

.PHONY: site test

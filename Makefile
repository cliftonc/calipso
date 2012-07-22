
REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500

test:
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS)

test-debug-brk:
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS) --debug-brk

test-debug:
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS) --debug

test-cov:
	-rm -rf lib-cov
	jscoverage --no-highlight lib lib-cov
	-NODE_ENV=mocha CALIPSO_COV=1 ./node_modules/.bin/mocha --reporter html-cov -t 5000 -s 500 > docs/coverage.html
	rm -rf lib-cov

site:
	rm -fr /tmp/docs \
	&& cp -fr docs /tmp/docs \
	&& git checkout gh-pages \
  	&& cp -fr /tmp/docs/* . \
    && echo "Pages updated ..."

.PHONY: site test test-cov test-debug test-debug-brk lib-cov

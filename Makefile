
REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500

jscoverage: ./node_modules/jscoverage/jscoverage.node

./node_modules/jscoverage/jscoverage.node:
	npm install jscoverage

test: jscoverage
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS)

test-debug-brk: jscoverage
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS) --debug-brk

test-debug: jscoverage
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS) --debug

test-cov: jscoverage
	-rm -rf lib-cov
	jscoverage --no-highlight lib lib-cov
	-NODE_ENV=mocha CALIPSO_COV=1 ./node_modules/.bin/mocha --reporter html-cov -t 5000 -s 500 > docs/coverage.html
	rm -rf lib-cov

site:
	-mkdir ./tmp
	cd ./tmp \
	&& git clone git@github.com:cliftonc/calipso.git -b gh-pages gh-pages \
	&& cp ../docs/* ./gh-pages \
	&& cd ./gh-pages \
	&& git commit -a -m "Update Pages" \
	&& git push \
	&& cd .. \
	&& rm -rf gh-pages \
	&& echo "Pages Updated"

.PHONY: site test test-cov test-debug test-debug-brk lib-cov jscoverage

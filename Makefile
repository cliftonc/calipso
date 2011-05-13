TESTS = test/*.js

test:
	@NODE_ENV=test expresso -s \
		-I lib \
		$(TESTS)

test-cov:
	@TESTFLAGS=--cov $(MAKE) test

.PHONY: test test-cov

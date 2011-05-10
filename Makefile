TESTS = test/*.js

test:
	@expresso \
		-I lib \
		$(TESTS)

test-cov:
	@TESTFLAGS=--cov $(MAKE) test

.PHONY: test test-cov

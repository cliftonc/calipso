#!/usr/bin/env bash
# Simple bash installation script for Calipso
# We have to manually install mongodb with native (this does mean its done twice)
echo "Installing mongodb in native mode ..."
npmResult=$(npm install mongodb --mongodb:native)

# Lets try our sanity test
echo 'Running sanity tests ...'
sanityTest=$(make)

# Check to see if we got all 100%
echo 'If you can see 100% success on the sanity tests then you are probably good to go!'
exit 0

#!/usr/bin/env bash
# Simple bash installation script for Calipso

# Make sure we have node and npm installed
node=`node --version`
npm=`npm --version`

echo "Using Node version: $node"
echo "Using NPM version: $npm"

# Check that we have ok permissions
if [[ -w . ]] ; then
    echo "You have write permission to the current folder."
else
    echo "You don't have the required read/write access to the Calipso folder! You need to execute: sudo chmod -R u+rw ."
    exit
fi

# Check that we are in the root Folder
if [[ -r ./app.js ]] ; then
  echo "The current folder appears to be Calipso (or something like it!)"
else
  echo "You need to run this command from the Calipso base folder (not bin)."
  exit
fi

# Checking that you have expat
echo "Checking for libexpat ..."
if ! locate libexpat.so 1> /dev/null; then
  echo "You don't seem to have libexpat-dev installed!  Calipso relies on this library for the node-expat module used to parse XML.  Please install via apt-get (or from source)."
  exit
else
  echo "Libexpat OK"
fi

# Lets try npm install
echo "Installing dependencies via NPM ... please be patient this can take a few minutes ..."
npmResult=`npm install`

# Quick check of modules
if [[ -r ./node_modules/express ]] ; then
  if [[ -r ./node_modules/mongodb ]] ; then
    if [[ -r ./node_modules/node-expat ]] ; then
      echo "It appears that NPM has installed the key modules ..."
    else
      echo "NPM failed to install node-expat"
      exit
    fi
  else
    echo "NPM failed to install mongodb"
    exit
  fi
else
  echo "NPM failed to install express"
  exit
fi

# Lets try our sanity test
echo "Running sanity tests ..."
sanityTest=`make`

# Check to see if we got all 100%
echo "If you can see 100% success on the sanity tests then you are probably good to go!"

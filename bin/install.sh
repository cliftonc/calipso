#!/usr/bin/env bash
# Simple bash installation script for Calipso

# Make sure we have node and npm installed
node=$(node --version)
npm=$(npm --version)

E_ERROR=1

echo "Using Node version: $node"
echo "Using NPM version: $npm"

# Check that we have ok permissions
if [[ -w . ]] ; then
    echo 'You have write permission to the current folder.'
else
    echo "You don't have the required read/write access to the Calipso folder! You need to execute: sudo chmod -R u+rw ." >&2
    exit $E_ERROR
fi

# Check that we are in the root Folder
if [[ -r ./app.js ]] ; then
  echo 'The current folder appears to be Calipso (or something like it!)'
else
  echo 'You need to run this command from the Calipso base folder (not bin).' >&2
  exit $E_ERROR
fi

# Checking that you have expat
echo 'Checking for libexpat ...'
if locate libexpat.so > /dev/null; then
  echo 'Libexpat OK'
else
  echo "You don't seem to have libexpat-dev installed!  Calipso relies on this library for the node-expat module used to parse XML.  Please install via apt-get (or from source)." >&2
  exit $E_ERROR
fi

# Lets try npm install
echo "Installing dependencies via NPM ... please be patient this can take a few minutes ..."
npmResult=$(npm install)

# Quick check of modules
if [[ -r ./node_modules/express ]] ; then
  if [[ -r ./node_modules/mongodb ]] ; then
    if [[ -r ./node_modules/node-expat ]] ; then
      echo "It appears that NPM has installed the key modules ..."
    else
      echo 'NPM failed to install node-expat' >&2
      exit $E_ERROR
    fi
  else
    echo 'NPM failed to install mongodb' >&2
    exit $E_ERROR
  fi
else
  echo 'NPM failed to install express' >&2
  exit $E_ERROR
fi

# Lets try our sanity test
echo 'Running sanity tests ...'
sanityTest=$(make)

# Check to see if we got all 100%
echo 'If you can see 100% success on the sanity tests then you are probably good to go!'

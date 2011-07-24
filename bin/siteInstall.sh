#!/usr/bin/env bash
# Simple bash installation script for Calipso
# We have to manually install mongodb with native (this does mean its done twice)
echo "Installing mongodb in native mode ..."
npmResult=$(npm install mongodb --mongodb:native)
exit 0

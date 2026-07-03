#!/usr/bin/env bash
set -euo pipefail

site_dir="${1:-_site}"

if [[ -z "$site_dir" || "$site_dir" == "/" ]]; then
  echo "Refusing to build into an unsafe output directory: $site_dir" >&2
  exit 1
fi

rm -rf "$site_dir"
mkdir -p "$site_dir/hasik"

cp -R index.html history.html recruit.html guide.html robots.txt sitemap.xml ads.txt assets articles pantry lunchtime "$site_dir"/
cp -R hasik/out/. "$site_dir/hasik/"
touch "$site_dir/.nojekyll"

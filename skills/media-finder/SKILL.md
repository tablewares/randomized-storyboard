---
name: media-finder

description: Skill to find image urls.
---
# Use  
 `opencli yandeximages search '<search-query>' --limit 10 -f json | jq -r '.[].image_url'`

## Installation
Install opencli first
then 
```bash
mkdir -p ~/.opencli/clis/images
mv bin/search.js ~/.opencli/clis/images/
```

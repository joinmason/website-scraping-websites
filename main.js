import Apify from 'apify';


/* VALIDATORS AND CLEANERS */
// Take any urls and check for misconfigs from sales/onboarding inputs
const cleanInstagram = urlString=> {
   // https://stackoverflow.com/questions/1707299/how-to-extract-a-string-using-javascript-regex
   // https://regexr.com/5tbdb      (?<=instagram.com\/)[A-Za-z0-9_.]+
   // uses a regex string to parse out the username and adds it to a properly formatted url for apify
   return  "https://www.instagram.com/"+("(?<=instagram.com\/)[A-Za-z0-9_.]+".match(urlString)[0] +"/";
}

// Verifies it is an actual instagram url without a request
const isInstagram = urlString=> {
   // https://stackoverflow.com/questions/18399997/url-validation-in-javascript-instagram-validation
   // uses regex to verify that it has no spaces and is in the proper format else will be disincluded from requests
   var urlPattern = new RegExp('"/^\s*(http\:\/\/)?instagram\.com\/[a-z\d-_]{1,255}\s*$/i"'); // validate fragment locator
   return !!urlPattern.test(urlString);
}

  if (typeOf instaString === "string"){
   RUN IN LOOP AND DO A RETURN
   insta[a] = instaString;
}

let usernames;

    if (input.username) {
        usernames = input.username;  
    } else if (input.usernames) {
        usernames = input.usernames;
    } else {
        console.log("What are you trying to get? It seems you forgot to add any input.")
    }
    
    usernames = Array.from(new Set(input.usernames))

    // we should probably remove white spaces

    let directUrls = [];
    for (const u in usernames) {
        if (usernames[u].toLowerCase().includes('instagram.com/')) {
            directUrls.push(usernames[u])    
        } else if (usernames[u] === '') {
//get rid of empty lines
        } else {
            const directUrl = `https://www.instagram.com/${usernames[u].replace(" ","")}`;
            directUrls.push(directUrl);
        }
    }
bigString = ['https://www.instagram.com/hydreauxluxirie_medspa',
'https://www.instagram.com/laboussolemedspawellness/',
'https://www.instagram.com/laserloungemedspa/?hl=en',
'https://www.instagram.com/lineagestudionyc',
'https://www.instagram.com/beyond_thebeautychair',
'https://www.instagram.com/electrolysiscenter/',
'https://www.instagram.com/mymagnoliasmile',
'https://www.instagram.com/luminouswaxandesthetics/',
'https://www.instagram.com/incognitohtx',
'http://instagram.com/geneleemd', 
'http://www.instagram.com/theartofthearch',
'Instagram.com/cosmiccontouring',
'https://www.instagram.com/voyagemedspa/',
'https://www.instagram.com/multicarewellness',
'https://www.instagram.com/maxlifebody/',
'https://www.instagram.com/rejuvenatememedicalspa',
'https://www.instagram.com/newimagesculpt', 
'http://http://instagram.com/premierplasticsurgery',
'https://www.instagram.com/stlouisweightlosssecret',
'https://www.instagram.com/facecandybyandi']

// checks for valid linktree to pull requests
const isValidLinkTree = urlString=>{
   // https://regex101.com/library/V0QtXe?amp%3Bsearch=card&orderBy=LEAST_POINTS&page=348
   var urlPattern = new RegExp('(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)$/i');
   return !!urlPattern.test(urlString);
}

// checks if the url is valid without spaces to be requested
const isValidUrl = urlString=> {
   // https://validators.readthedocs.io/en/latest/_modules/validators/url.html
   
   // https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
      var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
       '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
       '((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
       '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
       '(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
       '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
     return !!urlPattern.test(urlString);
}

Apify.main(async () => {


//const { name, profiles, domains } = await Apify.getInput();

const input = await Apify.getInput();
console.log(input['profiles']);
const name =  Array.from(new Set(input.name));
const profiles = Array.from(new Set(input.profile));
const domains = Array.from(new Set(input.domain));

const directUrls = profiles;
console.log(profiles);
//profiles scrape
//name scraope
const insta_valid = [];

const instagramCall = await Apify.call('jaroslavhejlek/instagram-scraper', { 
   ...input,
   resultsType: "details",
   directUrls, 
   "resultsType": "details",
   "resultsLimit":1,
   proxy: {
      "useApifyProxy": true,
      "apifyProxyGroups": ["RESIDENTIAL"]
   },
});

const { datasetId } = instagramCall;
 
// get Instagram dataset items
const { items } = client.dataset(datase.tId).list();
const linkTreesToCheck = [];
 
for (const item of items) {
  const { biography, url } = item;
  if (biography.includes('linktr.ee')) {
     linkTreesToCheck.push({ link: biography.match('linktr.ee'), url });
  } else {
     await Apify.pushData({ payInBio: biography.includes('/pay.withcherry.com/'), url });
  }
}
 
if (linkTreesToCheck.length) {
   // this is a web-scraper task that will only receive the URLS/need another task actor for just the links, and then for the other actor just have the liks
   const linkTreeRun = await Apify.callTask('pay-with-cherry-domain', {
      startUrls: linkTreesToCheck.map(({ url, link }) => ({
          url: link,
          userData: {
              url // this is the instagram profile, so we can link them after
          }
      }))
   });
   // the data is available in request.userData.url inside the page function
   const { items } = await client.dataset(linkTreeRun.defaultDatasetId).list();
    
   for (const { payInLinktree, url } of items) {
       await Apify.pushData({ payInLinktree, url });
   }
}

(?<=instagram.com\/)[A-Za-z0-9_.]+
 
if (domains.length) {
   // this is another task that will take the domains from input
   const domainRun = await Apify.callTask('pay-with-cherry-domain', {
      startUrls: domains.map((url) => ({
          url,
      })),   
   });
    
   // the request.url will be available inside the page function
   const { items } = await client.dataset(domainRun.defaultDatasetId).list();
    
   for (const { payInWebsite, url } of items) {
       await Apify.pushData({ payInWebsite, url });
   }
}


});


/*
Scraps to be deleted later
if isValidUrl

add url misses here in hashmap
 Object.keys(dict).map(function(k){
    return dict[k];
}).join(',');

"
(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)
//https://regex101.com/library/V0QtXe?amp%3Bsearch=card&orderBy=LEAST_POINTS&page=348

//https://stackoverflow.com/questions/18399997/url-validation-in-javascript-instagram-validation
/*insta_re = "/^\s*(http\:\/\/)?instagram\.com\/[a-z\d-_]{1,255}\s*$/i"
for(item in profiles){
   if !(item.test(insta_re)){insta_valid.push(item);}  
}
//first print invalud
console.log(insta_valid);
//test results limit and then also test if the call is possible on it
// /(?:(?:http|https):\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([A-Za-z0-9-_\.]+)/im


*/
import Apify from 'apify';
 
const { name, profiles, domains } = await Apify.getInput();

const instagramCall = await Apify.call('jaroslavhejlek/instagram-scraper', { 
 ...input,
     resultsType: "details",
       directUrls, 
   //[ "https://www.instagram.com/profile"], //make sure ni input not na
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
   // this is a web-scraper task that will only receive the URLS
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
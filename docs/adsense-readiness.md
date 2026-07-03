# Google AdSense review readiness

Last updated: 2026-07-03

## Official policy basis

- Google AdSense eligibility requires original content that complies with AdSense Program policies and a publisher who can access the site's HTML source.
- Google's page readiness guidance emphasizes unique content, clear navigation, and a good user experience.
- Google Publisher Policies prohibit illegal, deceptive, hateful, infringing, scraped, or otherwise unsafe content.
- AdSense Program policies prohibit invalid clicks, click encouragement, deceptive ad placement, misleading navigation, pop-ups, and placing ads on non-content pages.
- AdSense required privacy disclosures include third-party advertising cookies, Google's advertising cookies, personalized ads, and an opt-out path through Google Ads Settings.

## Current site status

- Production URL: `https://baksu.kr`
- Hosting: AWS Amplify Hosting, `ap-northeast-2`, app ID `d17o4anp55pfzo`
- Fallback Amplify URL: `https://main.d17o4anp55pfzo.amplifyapp.com`
- Custom domain: `baksu.kr`, `www.baksu.kr`
- Content base: static root pages plus article pages under `/articles/`
- Policy page: `/guide.html`
- Privacy section: `/guide.html#privacy`
- Terms section: `/guide.html#terms`
- Community policy section: `/guide.html#community`
- Contact section: `/guide.html#contact`
- Sitemap: `/sitemap.xml`
- Robots: `/robots.txt`

## Completed preparation

- Confirmed the site is publicly reachable on AWS Amplify.
- Added the `baksu.kr` custom domain association in AWS Amplify.
- Added Amplify DNS records in Gabia for ACM certificate validation, `www.baksu.kr`, and the root `baksu.kr` record.
- Updated canonical URLs, `robots.txt`, and `sitemap.xml` to the production custom domain.
- Confirmed key routes return `200` on the fallback Amplify URL: `/`, `/lunchtime/`, `/pantry/`, `/articles/`, `/hasik/`, `/robots.txt`, `/sitemap.xml`.
- Added explicit AdSense-oriented privacy language for Google and third-party advertising cookies.
- Kept contact and reporting path visible through the shared footer on root pages and article pages.
- Confirmed the site has navigation to company info, history, service areas, article pages, application page, policy page, and contact section.

## Must do before submitting to AdSense

- Wait until `https://baksu.kr` resolves, serves HTTPS, and the Amplify custom domain status becomes available.
- Create or open the user's AdSense account.
- Add the production site URL in AdSense: `https://baksu.kr`.
- Copy the publisher-specific AdSense verification/Auto ads code from AdSense.
- Paste the AdSense code into the `<head>` of every public HTML page, or add a shared include/build step before deployment.
- Rebuild/redeploy the static site after the publisher code is added.
- After AdSense provides a publisher ID, add a valid `ads.txt` file if AdSense requests it. Do not publish a placeholder `ads.txt`.

## Recommended review checklist

- Review every article for originality and remove copied, scraped, or thin content.
- Keep prohibited content out of community and article pages: hate, harassment, adult content, illegal activity, deceptive claims, copyrighted copies, phishing, and spam.
- Do not add language that asks visitors to click ads or support the site by viewing ads.
- Do not place ads where they can be confused with navigation, buttons, downloads, or chat controls.
- Avoid pop-ups, forced redirects, auto-downloads, and layouts that obscure content.
- Keep the privacy, terms, community policy, and contact links visible from the footer.
- If users from the EEA, UK, or Switzerland are expected, configure a Google-certified CMP or AdSense Privacy & messaging consent flow before serving personalized ads.

## Sources to recheck

- https://support.google.com/adsense/answer/9724
- https://support.google.com/adsense/answer/7299563
- https://support.google.com/adsense/answer/48182
- https://support.google.com/adsense/answer/10502938
- https://support.google.com/adsense/answer/1348695
- https://support.google.com/adsense/answer/7670013

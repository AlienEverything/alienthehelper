# Orbit Outpost

Orbit Outpost is an alien-themed study timer. Focus sessions earn credits, chart stars, and develop the habitat where you studied. The site runs as static HTML, CSS, and JavaScript. Puter handles accounts and private cloud saves. [Puter website integration](https://docs.puter.com/supported-platforms/) · [Puter account storage](https://docs.puter.com/security/)

## Open it locally

From this project folder, run the following command with Node.js and open [your local outpost](http://127.0.0.1:4186/).

```sh
node preview.cjs
```

Choose **Create an account** or **Log in with Puter**. The site opens Puter’s account window. Use the same Puter account and website address on each device to access your timer, tasks, subjects, notes, credits, collection, challenges, and atlas. Internet access is required to sign in and confirm changes. An active timer uses its saved finish time and can settle when you reconnect.

## GitHub Pages

The project lives on `main`. The `gh-pages` branch holds the contents of `dist` at its root, including `index.html`, `.nojekyll`, and `assets`.

To publish an update, test the changes on `main` and copy the contents of `dist` to the root of `gh-pages`. Commit and push to that branch. GitHub Pages uses **Deploy from a branch → gh-pages → / (root)**. Open the same published address on each device when signing in.

The frontend needs no build step, developer account with Puter, API key, or application secret. See [GitHub’s Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Bring an existing outpost

On the same website address, the first login to an empty account offers to import existing browser progress. The prompt shows how many sessions and credits it found.

Puter scopes app storage to the website’s origin. To move your outpost from the local preview or an older hosted address to GitHub Pages, use **Settings → Export** on the old site, then sign in and use **Settings → Restore** on the new site. Restore asks for confirmation before replacing the destination account’s progress. Backups include completed sessions and setup. Finish an active timer before exporting if you want to include that session. [Puter website origins](https://docs.puter.com/supported-platforms/)

## Check the project

Run the regression tests with Node.js 22 or newer from the project folder.

```sh
node --test
```

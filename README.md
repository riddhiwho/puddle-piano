# Puddle Piano

A playful, hand-drawn storybook piano garden for first notes. It is a dependency-free static site using the browser’s built-in Web Audio API and is designed for both laptop keyboards and mobile touch.

## Run locally

Open `index.html` in a browser, or from this folder run:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Publish free with GitHub Pages

1. Create a new public GitHub repository named `puddle-piano`.
2. Upload the contents of this directory (including `.github/workflows/deploy.yml`).
3. In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
4. Push to the `main` branch. The workflow publishes the website at `https://YOUR-USERNAME.github.io/puddle-piano/`.

GitHub Pages hosts static HTML, CSS, and JavaScript, and GitHub Actions is the recommended deployment approach. Public repositories can use this deployment at no cost. See [GitHub’s Pages documentation](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically).

## Notes

- Piano sound is generated locally in the browser with the Web Audio API after the first interaction—no external audio service or network request is needed.
- No accounts, analytics, data collection, or server are required for this launch version.

### Sourcegraph Compute Client


You *must* run `sg start dotcom` for your Sourcegraph instance (yes `dotcom`) because otherwise requests have to be authed and I didn't figure it out. Start that now before doing anything else or things may not work.

The `https://sourcegraph.test:3443` endpoint *must* be available, that's what the client app connects to.

## Run the app

Just statically serve the `public` folder with the server of your choice. These should all work for you:

`npx browser-sync public --server`

or

`python3 -m http.server 8000 --directory public`

Note: you can see the raw HTTP query for each compute request logged in the console, if you want to see how the backend gets called. For example, it looks like this:

```
https://sourcegraph.test:3443/compute/stream?q=repo%3Asourcegraph%2Fsourcegraph%24%20content%3Aoutput((%5Cw%2B)%20-%3E%20%241)%20type%3Acommit%20after%3A%224%20months%20ago%22%20count%3Aall
```


## Develop 

### Install

- Mac: Download the [Mac installer for elm](https://github.com/elm/compiler/releases/download/0.19.1/installer-for-mac.pkg) and just run it. See [instructions](https://github.com/elm/compiler/tree/master/installers/mac) if you want to customize installation.
- Linux: [Instructions](https://github.com/elm/compiler/blob/master/installers/linux/README.md). Basically just get the binary distribution and put it on your path.
- Windows: Download the [Windows installer](https://github.com/elm/compiler/releases/download/0.19.1/installer-for-windows.exe) and just run it.

### Dev setup

**Install**

```
npm install elm-test elm-format
```

**Editors**

To get the best development experience, you really should take the time to just set up a couple of key things which is (a) format-on-save (b) diagnostics/annotations.
VS Code highly recommended. Other editors are on your own. If you want to just try things out all noncommital then I recommend just getting Vim/[Emacs](https://marketplace.visualstudio.com/items?itemName=lfs.vscode-emacs-friendly) bindings in VS Code because the integrated dev environment just works really well (on save, diagnostics, etc).

- [Elm extension](https://marketplace.visualstudio.com/items?itemName=Elmtooling.elm-ls-vscode) for VS Code.
- [Download FiraCode font](https://github.com/tonsky/FiraCode/releases/download/5.2/Fira_Code_v5.2.zip). Optional, but such a nice font. To install, unzip. Then double click all the files in `ttf` and click "Install font".
- Add font to VSCode in `settings.json`. Press `command+shift+P`, type `settings.json`, click `Open settings.json` (not the Default settings) one, then add this:

```json
    "editor.fontFamily": "Fira Code",
    "terminal.integrated.fontFamily": "Fira Code",
    "editor.fontLigatures": true,
```

Add these editor settings:

```json
    "editor.formatOnSave": true,
    "elmLS.onlyUpdateDiagnosticsOnSave": true,
```

In total your `settings.json` should look like this:

```json
{
   // ... your other junk

    "editor.fontFamily": "Fira Code",
    "terminal.integrated.fontFamily": "Fira Code",
    "editor.fontLigatures": true,
    
    "editor.formatOnSave": true,
    "elmLS.onlyUpdateDiagnosticsOnSave": true,
}
```

- Bonus: if you want to feel like a superhero bind `Show Hover` to a good shortcut command. Click the gear in the bottom left of VSCode, go `Keyboard Shortcuts` search for `showHover` and edit the key binding for `editor.action.showHover`

- Bonus: if you want to feel like a ninja too, search for `next problem` in `Keyboard Shortcuts` and bind that to something convenient.

## Running the dev environment

- `npx elm-spa server` should be the only command you need to run. It installs the deps and then runs a live reload server.

**Hack hack hack**

If you're sort of familiar with Elm it's easiest to just look at the
`Pages/Create.elm` page, which is almost entirely self-contained. There you can
change the view/UI actions, etc., or build your own thing. All the data results
come in as well-typed values on the `OnResults` message (streaming and parsing
is taken care of).

Here's a brief description of the pages, roughly in order of importance:

- `Pages/Create.elm` -> basic creation page that exposes all the raw power (query input and other options), all supported visualization modes, and a bunch of examples.
- `ViewData.elm` -> this is the bit that charts data and renders tabs. Normally it would be part of a single page, but the view is reused so much between the use case pages that I pulled it out to live here
- `Types.elm` -> App types and stream result types. The main type is `Facet`, which represents a compute unit (including the query, data, and e.g., different renderings/filters/views on that data)

The others do not really matter:

- `Pages/UseCaseBase.elm` -> a basic page I used to construct per-page examples of use cases. You can see other `UseCaseXYZ.elm` files which map to respective use cases.
- `StopWords.elm` -> some stop words to filter results
- `Styling.elm` -> just some colors n stuff
- `Stream.elm` -> just an interface to get stream results, it interfaces with `ports.js`. 
- `View.elm` -> just a thing needed by the `elm-spa` framework to understand some layouts. 

The rest is kinda self-explanatory.

**Resources**

- [Definitive Elm guide](https://guide.elm-lang.org/), if you're not familiar with the language/framework
- [`elm-spa`](https://www.elm-spa.dev/): This is a single page app (SPA) that uses a framework called `elm-spa` for routing and generating pages. You can mostly ignore this framework because I'm using it very simply, and really only wanted it to do some local storage persistence.
- [`elm-ui`](https://package.elm-lang.org/packages/mdgriffith/elm-ui/latest/) is the Elm package that powers the UI. You don't need to understand HTML or CSS, it just simplifies a lot of those constructs. It's sort of bootstrap-like with layout abstracted to rows/columns, and a bunch of other thoughtful design principles that naturally hook up to state update actions (button presses, etc.).
- [`elm-charts`](https://elm-charts.org/) powers the charts.

(Btw except for the main Elm guide, I learned about other elm packages and usage as I went along)

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Copy static files to dist
function copyStaticFiles() {
  // Copy popup.html and update script src
  let popupHtml = fs.readFileSync('popup.html', 'utf8');
  popupHtml = popupHtml.replace('src="popup.js"', 'src="popup.js"');
  fs.writeFileSync('dist/popup.html', popupHtml);
  
  // Copy manifest.json and update paths
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifest.background.service_worker = 'background.js';
  manifest.content_scripts[0].js = ['content.js'];
  manifest.web_accessible_resources[0].resources = ['injected.js'];
  manifest.action.default_icon = {
    '16': 'icon-main-16.png',
    '48': 'icon-main-48.png',
    '128': 'icon-main-128.png'
  };
  manifest.icons = {
    '16': 'icon-main-16.png',
    '48': 'icon-main-48.png',
    '128': 'icon-main-128.png'
  };
  fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
  
  // Copy icons
  const icons = ['icon-main-16.png', 'icon-main-48.png', 'icon-main-128.png'];
  icons.forEach(icon => {
    const iconPath = `assets/${icon}`;
    if (fs.existsSync(iconPath)) {
      fs.copyFileSync(iconPath, `dist/${icon}`);
    }
  });
  
  console.log('Static files copied to dist/');
}

// Main scripts that use imports
const mainBuildOptions = {
  entryPoints: [
    { in: 'src/popup/index.js', out: 'popup' },
    { in: 'src/background/index.js', out: 'background' },
    { in: 'src/content/index.js', out: 'content' }
  ],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  target: ['chrome90'],
  logLevel: 'info',
  drop: isWatch ? [] : ['console', 'debugger']
};

// Injected script - runs in page context, no imports needed
const injectedBuildOptions = {
  entryPoints: [
    { in: 'src/injected/index.js', out: 'injected' }
  ],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  minify: !isWatch,
  sourcemap: false,
  target: ['chrome90'],
  logLevel: 'info',
  drop: isWatch ? [] : ['console', 'debugger']
};

async function build() {
  try {
    copyStaticFiles();
    
    if (isWatch) {
      const mainCtx = await esbuild.context(mainBuildOptions);
      const injectedCtx = await esbuild.context(injectedBuildOptions);
      await Promise.all([mainCtx.watch(), injectedCtx.watch()]);
      console.log('Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(mainBuildOptions),
        esbuild.build(injectedBuildOptions)
      ]);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();


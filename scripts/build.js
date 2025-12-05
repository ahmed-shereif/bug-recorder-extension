const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

// Get absolute paths to handle UNC/WSL paths better
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy static files to dist
function copyStaticFiles() {
  // Copy popup.html and update script src
  const popupHtmlPath = path.join(projectRoot, 'popup.html');
  let popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  popupHtml = popupHtml.replace('src="popup.js"', 'src="popup.js"');
  fs.writeFileSync(path.join(distDir, 'popup.html'), popupHtml);
  
  // Copy manifest.json and update paths
  const manifestPath = path.join(projectRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
  // Remove host_permissions if present (not needed)
  if (manifest.host_permissions) {
    delete manifest.host_permissions;
  }
  fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  
  // Copy icons
  const icons = ['icon-main-16.png', 'icon-main-48.png', 'icon-main-128.png'];
  icons.forEach(icon => {
    const iconPath = path.join(projectRoot, 'assets', icon);
    if (fs.existsSync(iconPath)) {
      fs.copyFileSync(iconPath, path.join(distDir, icon));
    }
  });
  
  console.log('Static files copied to dist/');
}

// Main scripts that use imports
const mainBuildOptions = {
  entryPoints: {
    'popup': path.join(projectRoot, 'src/popup/index.js'),
    'background': path.join(projectRoot, 'src/background/index.js'),
    'content': path.join(projectRoot, 'src/content/index.js')
  },
  bundle: true,
  outdir: distDir,
  format: 'iife',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  target: ['chrome90'],
  logLevel: 'info',
  drop: isWatch ? [] : ['console', 'debugger']
};

// Injected script - runs in page context, no imports needed
const injectedBuildOptions = {
  entryPoints: {
    'injected': path.join(projectRoot, 'src/injected/index.js')
  },
  bundle: true,
  outdir: distDir,
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
    } else {
      await Promise.all([
        esbuild.build(mainBuildOptions),
        esbuild.build(injectedBuildOptions)
      ]);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();


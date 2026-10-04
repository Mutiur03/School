// Photo-tile classes shared by Gallery.tsx and GalleryModeration.tsx.
// Controls fade in on hover/focus; always visible on touch screens.
const REVEAL =
  'opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 pointer-coarse:opacity-100';

export const TILE_GRID =
  'grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8';

export const TILE_BUTTON =
  'bg-muted focus-visible:ring-ring relative block w-full overflow-hidden rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export const TILE_IMG =
  // text-transparent: a broken image would otherwise print its alt text over the tile
  'aspect-square w-full object-cover text-transparent transition-transform duration-200 group-hover/tile:scale-[1.03]';

// Selected photo shrinks inside a tinted frame, Google Photos style.
export const TILE_IMG_SELECTED = 'scale-[0.88] rounded-md group-hover/tile:scale-[0.88]';

export const TILE_OVERLAY = `pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pb-1.5 pt-8 text-left text-white ${REVEAL}`;

export const TILE_CHECK = `pointer-coarse:p-2 absolute left-1 top-1 flex cursor-pointer p-1 ${REVEAL}`;

// Round check: white ring over the photo, fills with primary when checked.
// Pairs with an `peer sr-only` checkbox right before it.
export const TILE_CHECK_BOX =
  'flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-black/20 text-transparent shadow-[0_1px_3px_rgb(0_0_0/0.4)] transition-colors hover:bg-black/35 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 [&>svg]:h-3 [&>svg]:w-3';

export const TILE_MENU = `absolute right-1.5 top-1.5 has-[[data-state=open]]:opacity-100 ${REVEAL}`;

export const LOCAL_PRODUCT_IMAGES: Record<string, string> = {
  "portable mini fan": "/products/portable-mini-fan.jpg",
  "pearl drop earrings": "/products/pearl-drop-earrings.jpeg",
  "makeup brush set": "/products/makeup-brush-set.jpg",
  "decorative vase": "/products/decorative-vase.jpeg",
  "sports tracksuit": "/products/sports-tracksuit.jpeg",
  "usb-c charger": "/products/usb-c-charger.jpg",
  "classic sunglasses": "/products/classic-sunglasses.jpeg",
  "lip balm": "/products/lip-balm.jpeg",
  "keychain set": "/products/keychain-set.jpeg",
  "artificial plant": "/products/artificial-plant.jpeg",
  "tablet stand": "/products/tablet-stand.jpeg",
  "travel organizer": "/products/travel-organizer.jpeg",
  "fashion handbag": "/products/fashion-handbag.jpeg",
  "rose face toner": "/products/rose-face-toner.jpg",
  "reusable shopping bag": "/products/reusable-shopping-bag.jpeg",
  "lunch box": "/products/lunch-box.jpg",
  "linen trousers": "/products/linen-trousers.jpeg",
  "power bank": "/products/power-bank.jpeg",
  "decorative mirror": "/products/decorative-mirror.jpeg",
  "desk calendar": "/products/desk-calendar.jpeg",
  "stationery set": "/products/stationery-set.jpeg",
  "notebook set": "/products/notebook-set.jpeg",
  "perfume mist": "/products/perfume-mist.jpeg",
  "hair serum": "/products/hair-serum.jpeg",
  "hooded sweatshirt": "/products/hooded-sweatshirt.jpeg",
  "smart watch": "/products/smart-watch.jpeg",
  "photo frame": "/products/photo-frame.jpeg",
  "cushion cover set": "/products/cushion-cover-set.jpeg",
  "travel mug": "/products/travel-mug.jpeg",
  "gift box": "/products/gift-box.jpeg",
  "travel pillow": "/products/travel-pillow.jpeg",
  "bluetooth speaker": "/products/bluetooth-speaker.jpeg",
  "scented candle": "/products/scented-candle.jpeg",
  "wall clock": "/products/wall-clock.jpeg",
  "wireless mouse": "/products/wireless-mouse.jpeg",
  "cotton hoodie": "/products/cotton-hoodie.jpeg",
  "casual polo shirt": "/products/casual-polo-shirt.jpeg",
  "hair conditioner": "/products/hair-conditioner.jpeg",
  "laptop sleeve": "/products/laptop-sleeve.jpeg",
  "canvas backpack": "/products/canvas-backpack.jpeg",
  "travel pouch": "/products/travel-pouch.jpeg",
  "analog wrist watch": "/products/analog-wrist-watch.jpeg",
  "hair clip set": "/products/hair-clip-set.jpeg",
  "formal shirt": "/products/formal-shirt.jpeg",
  "summer dress": "/products/summer-dress.jpeg",
  "gentle face cleanser": "/products/gentle-face-cleanser.jpeg",
  "hydrating face cream": "/products/hydrating-face-cream.jpeg",
  "usb flash drive": "/products/usb-flash-drive.jpeg",
  "smart led bulb": "/products/smart-led-bulb.jpeg",
  "mechanical keyboard": "/products/mechanical-keyboard.jpeg",
  "face mask": "/products/face-mask.jpeg",
  "vitamin c serum": "/products/vitamin-c-serum.jpeg",
  "laundry basket": "/products/laundry-basket.jpeg",
  "denim jeans": "/products/denim-jeans.jpeg",
  "winter jacket": "/products/winter-jacket.jpeg",
  "classic cotton t-shirt": "/products/classic-cotton-t-shirt.jpeg",
  "leather wallet": "/products/leather-wallet.jpeg",
  "glass water bottle": "/products/glass-water-bottle.jpeg",
  "ceramic coffee mug": "/products/ceramic-coffee-mug.jpeg",
  "wireless headphones": "/products/wireless-headphones.jpeg",
};

export function normalizeProductName(name: string) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getProductImage(
  productName: string,
  firestoreImage?: string
) {
  const storedImage = String(
    firestoreImage ?? ""
  ).trim();

  if (storedImage) {
    return storedImage;
  }

  const normalizedName =
    normalizeProductName(productName);

  return (
    LOCAL_PRODUCT_IMAGES[normalizedName] || ""
  );
}
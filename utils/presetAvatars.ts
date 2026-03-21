export interface IPresetAvatar {
  id: string;
  url: string;
}

export interface IPresetAvatarCategory {
  [key: string]: IPresetAvatar[];
}

const presetAvatars: IPresetAvatarCategory = {
  cool: [
    { id: 'cl1', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool1&backgroundColor=000000' },
    { id: 'cl2', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool2&backgroundColor=1a1a1a' },
    { id: 'cl3', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool3&backgroundColor=800080' },
    { id: 'cl4', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool4&backgroundColor=8b0000' },
    { id: 'cl5', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool5&backgroundColor=4a4a4a' },
    { id: 'cl6', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool6&backgroundColor=8b0000' },
    { id: 'cl7', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool7&backgroundColor=000000' },
    { id: 'cl8', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool8&backgroundColor=808080' },
    { id: 'cl9', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool9&backgroundColor=4169e1' },
    { id: 'cl10', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool10&backgroundColor=228b22' },
    { id: 'cl11', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool11&backgroundColor=ff4500' },
    { id: 'cl12', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cool12&backgroundColor=ff69b4' },
  ],
  vibrant: [
    { id: 'vc1', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant1&backgroundColor=ff0000' },
    { id: 'vc2', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant2&backgroundColor=ff6b00' },
    { id: 'vc3', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant3&backgroundColor=ffd700' },
    { id: 'vc4', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant4&backgroundColor=00ff00' },
    { id: 'vc5', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant5&backgroundColor=00ffff' },
    { id: 'vc6', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant6&backgroundColor=0000ff' },
    { id: 'vc7', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant7&backgroundColor=8b00ff' },
    { id: 'vc8', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant8&backgroundColor=ff00ff' },
    { id: 'vc9', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant9&backgroundColor=ff1493' },
    { id: 'vc10', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant10&backgroundColor=00bfff' },
    { id: 'vc11', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant11&backgroundColor=9acd32' },
    { id: 'vc12', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=vibrant12&backgroundColor=daa520' },
  ],
  pastel: [
    { id: 'ps1', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel1&backgroundColor=ffb6c1' },
    { id: 'ps2', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel2&backgroundColor=ffe4e1' },
    { id: 'ps3', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel3&backgroundColor=fff0f5' },
    { id: 'ps4', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel4&backgroundColor=e6e6fa' },
    { id: 'ps5', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel5&backgroundColor=b0e0e6' },
    { id: 'ps6', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel6&backgroundColor=afeeee' },
    { id: 'ps7', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel7&backgroundColor=98fb98' },
    { id: 'ps8', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel8&backgroundColor=f0fff0' },
    { id: 'ps9', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel9&backgroundColor=fffacd' },
    { id: 'ps10', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel10&backgroundColor=f5f5dc' },
    { id: 'ps11', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel11&backgroundColor=ffe4b5' },
    { id: 'ps12', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=pastel12&backgroundColor=ffdab9' },
  ],
  robots: [
    { id: 'rb1', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot1' },
    { id: 'rb2', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot2' },
    { id: 'rb3', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot3' },
    { id: 'rb4', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot4' },
    { id: 'rb5', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot5' },
    { id: 'rb6', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot6' },
    { id: 'rb7', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot7' },
    { id: 'rb8', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot8' },
    { id: 'rb9', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot9' },
    { id: 'rb10', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot10' },
    { id: 'rb11', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot11' },
    { id: 'rb12', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=robot12' },
  ],
  fun: [
    { id: 'fn1', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun1' },
    { id: 'fn2', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun2' },
    { id: 'fn3', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun3' },
    { id: 'fn4', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun4' },
    { id: 'fn5', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun5' },
    { id: 'fn6', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun6' },
    { id: 'fn7', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun7' },
    { id: 'fn8', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun8' },
    { id: 'fn9', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun9' },
    { id: 'fn10', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun10' },
    { id: 'fn11', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun11' },
    { id: 'fn12', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=fun12' },
  ],
};

export default presetAvatars;

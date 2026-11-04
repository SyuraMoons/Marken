import Image from "next/image";

const THIRD = ["left-0", "left-[-100%]", "left-[-200%]"];

// One third of a 3-panel Figma example image (Figma crops these with a 300% wide fill).
export function Sprite({ src, i, sizes, alt = "", priority, crop = "" }: { src: string; i: number; sizes: string; alt?: string; priority?: boolean; crop?: string }) {
  return (
    <div className={`absolute top-0 h-full w-[300%] ${THIRD[i]} ${crop}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
    </div>
  );
}

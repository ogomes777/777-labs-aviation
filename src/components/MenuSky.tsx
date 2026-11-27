import SimFlyLogo from './SimFlyLogo';

/** Menu backdrop: the original SimFly wing mark, softly cropped and tinted.
 * No canvas, animation loop, particles, or independent radar overlays. */
export default function MenuSky() {
  return (
    <div className="sfm__identity" aria-hidden="true">
      <div className="sfm__identity-wing">
        <SimFlyLogo />
      </div>
    </div>
  );
}

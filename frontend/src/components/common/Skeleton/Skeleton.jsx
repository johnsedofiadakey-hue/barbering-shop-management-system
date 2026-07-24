import styles from './Skeleton.module.scss';

function Skeleton({ width, height, borderRadius, className = '' }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;
  if (borderRadius) style.borderRadius = borderRadius;

  return <div className={`${styles.skeleton} ${className}`} style={style} aria-hidden="true" />;
}

export default Skeleton;

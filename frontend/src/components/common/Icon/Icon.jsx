import icons from '@assets/icons';
import styles from './Icon.module.scss';

function Icon({ className, name, size = 'md', color }) {
  const SvgIcon = icons[name];
  if (!SvgIcon) return null;

  const computedClassName = [className, styles.wrapper, styles[size]].join(' ');

  return (
    <span className={computedClassName} style={color ? { color } : undefined}>
      <SvgIcon width="100%" height="100%" className={styles.icon} />
    </span>
  );
}

export default Icon;

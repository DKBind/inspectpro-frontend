import styles from './Loader.module.css';

interface LoaderProps {
  /** 'overlay' covers the entire viewport, 'inline' sits within a container */
  variant?: 'overlay' | 'inline';
  /** 'spinner' or 'dots' animation style */
  type?: 'spinner' | 'dots';
  /** Small size for inline/button loading */
  small?: boolean;
  /** Optional loading text */
  text?: string;
}

const Loader = ({
  variant = 'inline',
  type = 'spinner',
  small = false,
  text,
}: LoaderProps) => {
  const content = (
    <>
      {type === 'spinner' ? (
        <div className={`${styles.spinner} ${small ? styles.spinnerSmall : ''}`}>
          <div className={styles.spinnerGlow} />
          <div className={styles.spinnerRing} />
        </div>
      ) : (
        <div className={styles.dotsContainer}>
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
        </div>
      )}
      {text && <span className={styles.loadingText}>{text}</span>}
    </>
  );

  if (variant === 'overlay') {
    return <div className={styles.loaderOverlay}>{content}</div>;
  }

  return <div className={styles.loaderInline}>{content}</div>;
};

export default Loader;

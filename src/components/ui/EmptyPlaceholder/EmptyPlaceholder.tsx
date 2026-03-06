import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import styles from './EmptyPlaceholder.module.css';

interface EmptyPlaceholderProps {
  /** Custom icon element, defaults to Inbox */
  icon?: ReactNode;
  /** Heading text */
  title?: string;
  /** Description text */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Optional action icon */
  actionIcon?: ReactNode;
}

const EmptyPlaceholder = ({
  icon,
  title = 'No data found',
  description = 'There are no items to display at the moment.',
  actionLabel,
  onAction,
  actionIcon,
}: EmptyPlaceholderProps) => {
  return (
    <div className={styles.emptyWrapper}>
      <div className={styles.iconContainer}>
        {icon || <Inbox />}
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actionLabel && onAction && (
        <button className={styles.actionBtn} onClick={onAction}>
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyPlaceholder;

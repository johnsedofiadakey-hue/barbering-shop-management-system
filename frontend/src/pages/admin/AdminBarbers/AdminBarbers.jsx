import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useShopSettings } from '@hooks/useShopSettings';
import styles from './AdminBarbers.module.scss';
import api from '@api';

import Icon from '@components/common/Icon/Icon';
import Pagination from '@components/common/Pagination/Pagination';
import Profile from '@components/ui/Profile/Profile';
import Rating from '@components/ui/Rating/Rating';
import Tag from '@components/common/Tag/Tag';
import Button from '@components/common/Button/Button';
import Modal from '@components/common/Modal/Modal';
import Input from '@components/common/Input/Input';
import Spinner from '@components/common/Spinner/Spinner';

function AdminBarbers() {
  const { profile } = useAuth();
  const shop = useShopSettings();
  const [barbers, setBarbers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Popup states
  const [deletePopup, setDeletePopup] = useState({ open: false, barber: null });
  const [invitePopup, setInvitePopup] = useState(false);
  const [editPopup, setEditPopup] = useState({ open: false, barber: null });

  /**
   * Defines fetching barbers from api (single responsibility, outside effect)
   */
  const fetchBarbers = useCallback(async () => {
    setIsLoading(true);

    try {
      const { barbers } = await api.admin.getAllBarbers();
      setBarbers(barbers);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Only fetch if profile is loaded AND user is admin
   */
  useEffect(() => {
    if (profile?.role === 'ADMIN') {
      fetchBarbers();
    }
  }, [profile, fetchBarbers]);

  // Invite popup state handlers
  const openInvitePopup = () => setInvitePopup(true);
  const closeInvitePopup = () => setInvitePopup(false);

  // Delete popup state handlers
  const openDeletePopup = (barber) => setDeletePopup({ open: true, barber });
  const closeDeletePopup = () => setDeletePopup({ open: false, barber: null });
  const openEditPopup = (barber) => setEditPopup({ open: true, barber });
  const closeEditPopup = () => setEditPopup({ open: false, barber: null });

  /**
   * Handles inviting a new barber
   */
  const handleInviteBarber = async ({ email }) => {
    await api.admin.inviteBarber({ email });
    closeInvitePopup();
    await fetchBarbers();
  };

  /**
   * Handles deleting the selected barber
   */
  const handleDeleteBarber = async (barberId) => {
    await api.admin.deleteBarber(barberId);
    closeDeletePopup();
    await fetchBarbers();
  };

  const handleUpdateBarber = async (fields) => {
    await api.admin.updateBarber(editPopup.barber.id, {
      ...fields,
      is_active: fields.is_active === true || fields.is_active === 'true',
    });
    closeEditPopup();
    await fetchBarbers();
  };

  // Only render UI for admins; otherwise, render nothing
  if (!profile || profile.role !== 'ADMIN') return null;

  return (
    <>
      {/* Registered Barbers Pagination */}
      <Pagination
        className={styles.adminBarbers}
        icon="barber"
        label="Barbers"
        itemsPerPage={5}
        loading={isLoading}
        emptyMessage="No barbers found." //
      >
        <Pagination.Action>
          <div className={styles.action}>
            <Button
              className={styles.refreshBtn}
              type="button"
              color="primary"
              size="md"
              onClick={fetchBarbers}
              disabled={isLoading}
            >
              <span className={styles.line}>
                {isLoading ? (
                  <>
                    <Spinner size={'sm'} /> Refreshing...
                  </>
                ) : (
                  <>
                    <Icon name="refresh" size="ty" /> Refresh barbers
                  </>
                )}
              </span>
            </Button>

            <Button
              className={styles.actionBtn}
              type="button"
              color="gold"
              size="md"
              onClick={openInvitePopup} //
            >
              <Icon name="plus" size="ty" />
              <span>Invite barber</span>
            </Button>
          </div>
        </Pagination.Action>

        {/* Table Headers */}
        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="user" size="ty" />
            <span className={styles.tableTitleName}>User</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="email_base" size="ty" />
            <span className={styles.tableTitleName}>Email</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="review" size="ty" />
            <span className={styles.tableTitleName}>Rating</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="revenue" size="ty" />
            <span className={styles.tableTitleName}>Revenue</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="check" size="ty" />
            <span className={styles.tableTitleName}>Joined</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="spinner" size="ty" />
            <span className={styles.tableTitleName}>Status</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="dial" size="ty" />
            <span className={styles.tableTitleName}>Actions</span>
          </div>
        </Pagination.Column>

        {/* Table Rows */}
        {barbers.map((barber) => (
          <Pagination.Row key={barber.id}>
            <Pagination.Cell>
              <Profile profile={barber} />
            </Pagination.Cell>

            <Pagination.Cell>
              <div className={styles.emailContainer}>
                <span className={styles.email}>{barber.email}</span>
              </div>
            </Pagination.Cell>

            <Pagination.Cell>
              <Rating rating={barber.average_rating} />
            </Pagination.Cell>

            <Pagination.Cell>
              <span className={styles.revenue}>
                {shop.currency_symbol} {barber.total_revenue}
              </span>
            </Pagination.Cell>

            <Pagination.Cell>
              <span className={styles.date}>{barber.date_joined.replaceAll('-', ' / ')}</span>
            </Pagination.Cell>

            <Pagination.Cell>
              <Tag className={styles.tag} color={barber.is_active ? 'green' : 'yellow'}>
                {barber.is_active ? 'Active' : 'Invited'}
              </Tag>
            </Pagination.Cell>

            <Pagination.Cell>
              <div className={styles.actions}>
                <Button
                  type="button"
                  size="sm"
                  color="actionbtn"
                  onClick={() => openEditPopup(barber)}
                  aria-label={`Edit ${barber.name || barber.email}`}
                >
                  <Icon name="pen" size="sm" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  color="actionbtn"
                  disabled={!barber.is_active}
                  href={`/admin/availabilities/barber/${barber.id}`} //
                >
                  <Icon name="availability" size="sm" />
                </Button>

                <Button
                  type="button"
                  size="sm"
                  color="actionbtn"
                  onClick={() => openDeletePopup(barber)} //
                >
                  <Icon name="trash" size="sm" />
                </Button>
              </div>
            </Pagination.Cell>
          </Pagination.Row>
        ))}
      </Pagination>

      {/* Invite Barber Modal */}
      <Modal
        open={invitePopup}
        fields={{ email: '' }}
        action={{ submit: 'Send', loading: 'Sending...' }}
        onSubmit={handleInviteBarber}
        onClose={closeInvitePopup}
      >
        <Modal.Title icon="email_base">Invite Barber</Modal.Title>
        <Modal.Description>Enter the barber&apos;s email address to send them an invitation to register.</Modal.Description>

        <Input
          label="Barber email"
          type="email"
          name="email"
          required
          placeholder="barber@email.com"
          size="md" //
        />
      </Modal>

      <Modal
        open={editPopup.open}
        fields={
          editPopup.barber
            ? {
                name: editPopup.barber.name || '',
                surname: editPopup.barber.surname || '',
                email: editPopup.barber.email || '',
                description: editPopup.barber.description || '',
                is_active: String(editPopup.barber.is_active),
                profile_image: null,
              }
            : {}
        }
        action={{ submit: 'Save barber', loading: 'Saving...' }}
        onSubmit={handleUpdateBarber}
        onClose={closeEditPopup}
      >
        <Modal.Title icon="barber">Barber profile</Modal.Title>
        <Modal.Description>
          Update the public name, specialist details, status, and photo clients see while booking.
        </Modal.Description>
        <Input label="First name" type="text" name="name" required maxLength={50} size="md" />
        <Input label="Last name" type="text" name="surname" required maxLength={50} size="md" />
        <Input label="Email" type="email" name="email" required size="md" />
        <Input label="Specialist description" type="text" name="description" maxLength={500} size="md" />
        <Input
          label="Status"
          type="dropdown"
          name="is_active"
          size="md"
          required
          fetcher={async () => [
            { key: 'true', value: 'Active and bookable' },
            { key: 'false', value: 'Hidden from booking' },
          ]}
        />
        <Input label="Barber photo" type="file" name="profile_image" accept="image/*" placeholder="Choose barber photo" />
      </Modal>

      {/* Delete Barber Modal */}
      <Modal
        open={deletePopup.open}
        action={{ submit: 'Delete', loading: 'Deleting...' }}
        onSubmit={() => handleDeleteBarber(deletePopup.barber?.id)}
        onClose={closeDeletePopup}
      >
        <Modal.Title icon="warning">Delete Barber</Modal.Title>
        <Modal.Description>
          Are you sure you want to delete <strong>{deletePopup.barber?.username || deletePopup.barber?.email}</strong> ? This
          action cannot be undone.
        </Modal.Description>
      </Modal>
    </>
  );
}

export default AdminBarbers;

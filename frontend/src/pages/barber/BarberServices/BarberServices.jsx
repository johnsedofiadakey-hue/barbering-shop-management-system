import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { cleanPayload, isAnyFieldSet } from '@utils/utils';
import styles from './BarberServices.module.scss';
import api from '@api';

import Icon from '@components/common/Icon/Icon';
import Pagination from '@components/common/Pagination/Pagination';
import Button from '@components/common/Button/Button';
import Modal from '@components/common/Modal/Modal';
import Input from '@components/common/Input/Input';
import Spinner from '@components/common/Spinner/Spinner';

function BarberServices() {
  const { profile } = useAuth();
  const [services, setServices] = useState([]);
  const [currencySymbol, setCurrencySymbol] = useState('GH₵');
  const [isLoading, setIsLoading] = useState(true);

  // Popup states
  const [createPopup, setCreatePopup] = useState(false);
  const [deletePopup, setDeletePopup] = useState({ open: false, service: null });
  const [updatePopup, setUpdatePopup] = useState({ open: false, service: null });

  /**
   * Defines fetching services from api (single responsibility, outside effect)
   */
  const fetchServices = useCallback(async () => {
    setIsLoading(true);

    try {
      const { services } = await api.barber.getBarberServices();
      setServices(services);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Only fetch if profile is loaded AND user is barber
   */
  useEffect(() => {
    if (profile?.role === 'BARBER') {
      fetchServices();
      api.pub
        .getShopSettings()
        .then(({ shop }) => setCurrencySymbol(shop.currency_symbol || 'GH₵'))
        .catch(() => {});
    }
  }, [profile, fetchServices]);

  // Invite popup state handlers
  const openCreatePopup = () => setCreatePopup(true);
  const closeCreatePopup = () => setCreatePopup(false);

  // Delete popup state handlers
  const openDeletePopup = (service) => setDeletePopup({ open: true, service });
  const closeDeletePopup = () => setDeletePopup({ open: false, service: null });

  // Update popup state handlers
  const openUpdatePopup = (service) => setUpdatePopup({ open: true, service });
  const closeUpdatePopup = () => setUpdatePopup({ open: false, service: null });

  /**
   * Handles inviting a new service
   */
  const handleCreateService = async ({ name, description, duration_minutes, price, image }) => {
    await api.barber.createBarberService({ name, description, duration_minutes, price, image });
    closeCreatePopup();
    await fetchServices();
  };

  /**
   * Handles deleting the selected service
   */
  const handleDeleteService = async (serviceId) => {
    await api.barber.deleteBarberService(serviceId);
    closeDeletePopup();
    await fetchServices();
  };

  /**
   * Handles updating the selected service
   */
  const handleUpdateService = async (serviceId, payload) => {
    await api.barber.updateBarberService(serviceId, payload);
    closeUpdatePopup();
    await fetchServices();
  };

  // Only render UI for admins; otherwise, render nothing
  if (!profile || profile.role !== 'BARBER') return null;

  return (
    <>
      {/* Offered Services Pagination */}
      <Pagination
        className={styles.barberServices}
        icon="service"
        label="Services"
        itemsPerPage={5}
        loading={isLoading}
        emptyMessage="No services offered." //
      >
        <Pagination.Action>
          <div className={styles.action}>
            <Button
              className={styles.refreshBtn}
              type="button"
              color="primary"
              size="md"
              onClick={fetchServices}
              disabled={isLoading}
            >
              <span className={styles.line}>
                {isLoading ? (
                  <>
                    <Spinner size={'sm'} /> Refreshing...
                  </>
                ) : (
                  <>
                    <Icon name="refresh" size="ty" /> Refresh services
                  </>
                )}
              </span>
            </Button>

            <Button
              className={styles.actionBtn}
              type="button"
              color="gold"
              size="md"
              onClick={openCreatePopup} //
            >
              <Icon name="plus" size="ty" />
              <span>Create service</span>
            </Button>
          </div>
        </Pagination.Action>

        {/* Table headers */}
        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="scissors" size="ty" />
            <span className={styles.tableTitleName}>Service</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="hourglass" size="ty" />
            <span className={styles.tableTitleName}>Duration</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="revenue" size="ty" />
            <span className={styles.tableTitleName}>Price</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="id" size="ty" />
            <span className={styles.tableTitleName}>Service ID</span>
          </div>
        </Pagination.Column>

        <Pagination.Column>
          <div className={styles.tableTitle}>
            <Icon name="dial" size="ty" />
            <span className={styles.tableTitleName}>Actions</span>
          </div>
        </Pagination.Column>

        {/* Table rows */}
        {services.map((service) => (
          <Pagination.Row key={service.id}>
            <Pagination.Cell>
              <div className={styles.serviceIdentity}>
                {service.image ? <img src={service.image} alt="" /> : <Icon name="scissors" size="md" />}
                <span className={styles.serviceName}>{service.name}</span>
              </div>
            </Pagination.Cell>

            <Pagination.Cell>
              <span>{service.duration_minutes} min</span>
            </Pagination.Cell>

            <Pagination.Cell>
              <span className={styles.servicePrice}>
                {currencySymbol} {service.price}
              </span>
            </Pagination.Cell>

            <Pagination.Cell>
              <div className={styles.serviceId}>
                <span className={styles.hash}># </span>
                <span className={styles.id}>{service.id} </span>
              </div>
            </Pagination.Cell>

            <Pagination.Cell>
              <div className={styles.actions}>
                <Button
                  type="button"
                  size="sm"
                  color="actionbtn"
                  onClick={() => openUpdatePopup(service)} //
                >
                  <Icon name="pen" size="ty" />
                </Button>

                <Button
                  type="button"
                  size="sm"
                  color="actionbtn"
                  onClick={() => openDeletePopup(service)} //
                >
                  <Icon name="trash" size="ty" />
                </Button>
              </div>
            </Pagination.Cell>
          </Pagination.Row>
        ))}
      </Pagination>

      {/* Create Service Modal */}
      <Modal
        open={createPopup}
        fields={{ name: '', description: '', duration_minutes: 30, price: '', image: null }}
        action={{ submit: 'Create', loading: 'Creating...' }}
        onSubmit={handleCreateService}
        onClose={closeCreatePopup}
      >
        <Modal.Title icon="id">Create Service</Modal.Title>
        <Modal.Description>Add a clear name, timing, and price so clients know exactly what they are booking.</Modal.Description>

        <Input
          label="Service name"
          type="text"
          name="name"
          required
          placeholder="Haircut"
          size="md" //
        />

        <Input
          label="Short description"
          type="text"
          name="description"
          placeholder="Skin fade, line-up and finish"
          maxLength={240}
          size="md"
        />

        <Input label="Duration (minutes)" type="number" name="duration_minutes" min="10" max="480" required size="md" />

        <Input
          label="Service Price"
          type="number"
          min="1"
          step="any"
          name="price"
          required
          placeholder="25.99"
          size="md" //
        />

        <Input label="Service image" type="file" name="image" accept="image/*" placeholder="Choose service photo" />
      </Modal>

      {/* Delete Service Modal */}
      <Modal
        open={deletePopup.open}
        action={{ submit: 'Delete', loading: 'Deleting...' }}
        onSubmit={() => handleDeleteService(deletePopup.service?.id)}
        onClose={closeDeletePopup}
      >
        <Modal.Title icon="warning">Delete Service</Modal.Title>
        <Modal.Description>
          Are you sure you want to delete <strong>{deletePopup.service?.name}</strong>? This action cannot be undone.
        </Modal.Description>
      </Modal>

      {/* Update Service Modal */}
      <Modal
        open={updatePopup.open}
        fields={{ name: '', description: '', duration_minutes: '', price: '', image: null }}
        action={{ submit: 'Update', loading: 'Updating...' }}
        onValidate={(payload) =>
          isAnyFieldSet(payload, 'Provide a new name, description, duration, price, or image to update the service.')
        }
        onSubmit={(payload) => handleUpdateService(updatePopup.service?.id, cleanPayload(payload))}
        onClose={closeUpdatePopup}
      >
        <Modal.Title icon="pen">Update Service</Modal.Title>
        <Modal.Description>
          Enter new values to update the service: <strong>{updatePopup.service?.name}</strong>. This action cannot be undone.
        </Modal.Description>

        <Input
          label="Service name"
          type="text"
          name="name"
          placeholder={updatePopup.service?.name}
          size="md" //
        />

        <Input
          label="Short description"
          type="text"
          name="description"
          placeholder={updatePopup.service?.description || 'Add a concise description'}
          maxLength={240}
          size="md"
        />

        <Input
          label="Duration (minutes)"
          type="number"
          name="duration_minutes"
          min="10"
          max="480"
          placeholder={updatePopup.service?.duration_minutes}
          size="md"
        />

        <Input
          label="Service Price"
          type="number"
          min="1"
          step="any"
          name="price"
          placeholder={updatePopup.service?.price}
          size="md" //
        />

        <Input label="Replace image" type="file" name="image" accept="image/*" placeholder="Choose a new service photo" />
      </Modal>
    </>
  );
}

export default BarberServices;

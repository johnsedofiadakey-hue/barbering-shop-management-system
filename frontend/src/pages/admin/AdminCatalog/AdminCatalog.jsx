import { useCallback, useEffect, useState } from 'react';
import api from '@api';
import styles from './AdminCatalog.module.scss';

import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';
import Input from '@components/common/Input/Input';
import Modal from '@components/common/Modal/Modal';
import Spinner from '@components/common/Spinner/Spinner';

function AdminCatalog() {
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [beforeAfter, setBeforeAfter] = useState([]);
  const [shop, setShop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [editService, setEditService] = useState(null);
  const [deleteService, setDeleteService] = useState(null);
  const [createCutOpen, setCreateCutOpen] = useState(false);
  const [deleteCut, setDeleteCut] = useState(null);
  const [createBeforeAfterOpen, setCreateBeforeAfterOpen] = useState(false);
  const [deleteBeforeAfter, setDeleteBeforeAfter] = useState(null);

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ services }, { barbers }, { portfolio }, { shop }, { before_after }] = await Promise.all([
        api.business.getServices(),
        api.admin.getAllBarbers(),
        api.business.getPortfolio(),
        api.business.getShopSettings(),
        api.business.getBeforeAfter(),
      ]);
      setServices(services || []);
      setBarbers(barbers || []);
      setPortfolio(portfolio || []);
      setBeforeAfter(before_after || []);
      setShop(shop);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const barberOptions = async () =>
    barbers.map((barber) => ({
      key: barber.id,
      value: `${barber.name || ''} ${barber.surname || ''}`.trim() || barber.username,
    }));

  const handleCreateService = async (fields) => {
    await api.business.createService(fields);
    setCreateServiceOpen(false);
    await fetchCatalog();
  };

  const handleUpdateService = async (fields) => {
    await api.business.updateService(editService.id, fields);
    setEditService(null);
    await fetchCatalog();
  };

  const handleDeleteService = async () => {
    await api.business.deleteService(deleteService.id);
    setDeleteService(null);
    await fetchCatalog();
  };

  const handleCreateCut = async (fields) => {
    await api.business.createPortfolioItem({ ...fields, active: true, featured: true });
    setCreateCutOpen(false);
    await fetchCatalog();
  };

  const handleDeleteCut = async () => {
    await api.business.deletePortfolioItem(deleteCut.id);
    setDeleteCut(null);
    await fetchCatalog();
  };

  const handleCreateBeforeAfter = async (fields) => {
    await api.business.createBeforeAfter({ ...fields, active: true });
    setCreateBeforeAfterOpen(false);
    await fetchCatalog();
  };

  const handleDeleteBeforeAfter = async () => {
    await api.business.deleteBeforeAfter(deleteBeforeAfter.id);
    setDeleteBeforeAfter(null);
    await fetchCatalog();
  };

  const currency = shop?.currency_symbol || 'GH₵';

  if (isLoading) return <Spinner />;

  return (
    <div className={styles.adminCatalog}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Public menu manager</span>
          <h1>Services & cut gallery</h1>
          <p>Control the menu clients see, attach a strong image to every service, and publish finished cuts.</p>
        </div>
        <div className={styles.heroActions}>
          <Button color="goldoutline" size="md" onClick={() => setCreateCutOpen(true)}>
            <Icon name="image" size="ty" /> Add finished cut
          </Button>
          <Button color="gold" size="md" onClick={() => setCreateServiceOpen(true)}>
            <Icon name="plus" size="ty" /> Add service
          </Button>
        </div>
      </header>

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Service menu</span>
            <h2>What customers can book</h2>
          </div>
          <p>
            {services.length} active menu item{services.length === 1 ? '' : 's'}
          </p>
        </div>

        {services.length ? (
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.id}>
                <div className={styles.media}>
                  {service.image ? (
                    <img src={service.image} alt={`${service.name} service`} />
                  ) : (
                    <div className={styles.mediaPlaceholder}>
                      <Icon name="scissors" size="lg" />
                      <span>Add a service photo</span>
                    </div>
                  )}
                  <span className={styles.barberBadge}>{service.barber_name}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span>{service.duration_minutes} min</span>
                    <strong>
                      {currency} {Number(service.price).toFixed(0)}
                    </strong>
                  </div>
                  <h3>{service.name}</h3>
                  <p>{service.description || 'Add a short description customers can understand at a glance.'}</p>
                  <div className={styles.cardActions}>
                    <Button color="goldoutline" size="sm" onClick={() => setEditService(service)}>
                      <Icon name="pen" size="ty" /> Edit & upload
                    </Button>
                    <Button
                      color="actionbtn"
                      size="sm"
                      aria-label={`Delete ${service.name}`}
                      onClick={() => setDeleteService(service)}
                    >
                      <Icon name="trash" size="ty" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Icon name="service" size="lg" />
            <h3>Your service menu is empty</h3>
            <p>Add the first bookable service, choose its barber, and upload an image.</p>
            <Button color="gold" size="md" onClick={() => setCreateServiceOpen(true)}>
              Add service
            </Button>
          </div>
        )}
      </section>

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Optional transformations</span>
            <h2>Before & after</h2>
          </div>
          <Button color="goldoutline" size="sm" onClick={() => setCreateBeforeAfterOpen(true)}>
            <Icon name="plus" size="ty" /> Add transformation
          </Button>
        </div>

        {beforeAfter.length ? (
          <div className={styles.transformationGrid}>
            {beforeAfter.map((item) => (
              <article className={styles.transformationCard} key={item.id}>
                <div className={styles.transformationImages}>
                  <figure>
                    <img src={item.before_image} alt={`Before ${item.title}`} />
                    <figcaption>Before</figcaption>
                  </figure>
                  <figure>
                    <img src={item.after_image} alt={`After ${item.title}`} />
                    <figcaption>After</figcaption>
                  </figure>
                </div>
                <div className={styles.transformationCopy}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description || [item.service_name, item.barber_name].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Button
                    color="actionbtn"
                    size="sm"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => setDeleteBeforeAfter(item)}
                  >
                    <Icon name="trash" size="ty" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Icon name="image" size="lg" />
            <h3>Before-and-after work is optional</h3>
            <p>Add transformation pairs when the shop has client-approved images worth showing.</p>
          </div>
        )}
      </section>

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Finished work</span>
            <h2>Landing-page lookbook</h2>
          </div>
          <Button color="goldoutline" size="sm" onClick={() => setCreateCutOpen(true)}>
            <Icon name="plus" size="ty" /> Upload cut
          </Button>
        </div>

        {portfolio.length ? (
          <div className={styles.cutGrid}>
            {portfolio.map((cut) => (
              <article className={styles.cutCard} key={cut.id}>
                <img src={cut.image} alt={cut.title} />
                <div className={styles.cutOverlay}>
                  <div>
                    <span>{cut.duration_minutes} min</span>
                    <h3>{cut.title}</h3>
                    <strong>
                      From {currency} {Number(cut.price).toFixed(0)}
                    </strong>
                  </div>
                  <Button color="actionbtn" size="sm" aria-label={`Delete ${cut.title}`} onClick={() => setDeleteCut(cut)}>
                    <Icon name="trash" size="ty" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Icon name="image" size="lg" />
            <h3>No finished cuts uploaded</h3>
            <p>Starter images remain public until you replace them with real work.</p>
          </div>
        )}
      </section>

      <Modal
        open={createServiceOpen}
        fields={{ barber_id: '', name: '', description: '', duration_minutes: 30, price: '', image: null }}
        action={{ submit: 'Publish service', loading: 'Publishing…' }}
        onSubmit={handleCreateService}
        onClose={() => setCreateServiceOpen(false)}
      >
        <Modal.Title icon="service">Add service</Modal.Title>
        <Modal.Description>Create a bookable menu item and add the image customers will see.</Modal.Description>
        <Input label="Barber" type="dropdown" name="barber_id" required fetcher={barberOptions} size="md" />
        <Input label="Service name" type="text" name="name" required maxLength={100} size="md" />
        <Input label="Description" type="text" name="description" maxLength={240} size="md" />
        <Input label="Duration (minutes)" type="number" name="duration_minutes" min="10" max="480" required size="md" />
        <Input label="Price" type="number" name="price" min="0" step="0.01" required size="md" />
        <Input label="Service image" type="file" name="image" accept="image/*" placeholder="Choose service photo" />
      </Modal>

      <Modal
        open={Boolean(editService)}
        fields={
          editService
            ? {
                barber_id: editService.barber_id,
                name: editService.name,
                description: editService.description || '',
                duration_minutes: editService.duration_minutes,
                price: editService.price,
                image: null,
              }
            : {}
        }
        action={{ submit: 'Save service', loading: 'Saving…' }}
        onSubmit={handleUpdateService}
        onClose={() => setEditService(null)}
      >
        <Modal.Title icon="pen">Edit service</Modal.Title>
        <Modal.Description>Update the menu details or choose a new image to replace the current one.</Modal.Description>
        <Input label="Barber" type="dropdown" name="barber_id" required fetcher={barberOptions} size="md" />
        <Input label="Service name" type="text" name="name" required maxLength={100} size="md" />
        <Input label="Description" type="text" name="description" maxLength={240} size="md" />
        <Input label="Duration (minutes)" type="number" name="duration_minutes" min="10" max="480" required size="md" />
        <Input label="Price" type="number" name="price" min="0" step="0.01" required size="md" />
        <Input label="Replace image" type="file" name="image" accept="image/*" placeholder="Choose new service photo" />
      </Modal>

      <Modal
        open={Boolean(deleteService)}
        action={{ submit: 'Delete service', loading: 'Deleting…' }}
        onSubmit={handleDeleteService}
        onClose={() => setDeleteService(null)}
      >
        <Modal.Title icon="warning">Delete service</Modal.Title>
        <Modal.Description>
          Delete <strong>{deleteService?.name}</strong>? Existing appointment history remains intact, but customers can no longer
          book it.
        </Modal.Description>
      </Modal>

      <Modal
        open={createCutOpen}
        fields={{ title: '', description: '', duration_minutes: 30, price: '', image: null, display_order: 0 }}
        action={{ submit: 'Publish cut', loading: 'Publishing…' }}
        onSubmit={handleCreateCut}
        onClose={() => setCreateCutOpen(false)}
      >
        <Modal.Title icon="image">Upload finished cut</Modal.Title>
        <Modal.Description>Publish real work to the premium landing-page lookbook.</Modal.Description>
        <Input label="Cut title" type="text" name="title" required maxLength={100} size="md" />
        <Input label="Description" type="text" name="description" maxLength={240} size="md" />
        <Input label="Duration (minutes)" type="number" name="duration_minutes" min="10" max="480" required size="md" />
        <Input label="Starting price" type="number" name="price" min="0" step="0.01" required size="md" />
        <Input label="Display order" type="number" name="display_order" min="0" size="md" />
        <Input label="Cut image" type="file" name="image" accept="image/*" required placeholder="Choose finished-cut photo" />
      </Modal>

      <Modal
        open={Boolean(deleteCut)}
        action={{ submit: 'Delete cut', loading: 'Deleting…' }}
        onSubmit={handleDeleteCut}
        onClose={() => setDeleteCut(null)}
      >
        <Modal.Title icon="warning">Delete finished cut</Modal.Title>
        <Modal.Description>
          Remove <strong>{deleteCut?.title}</strong> from the public lookbook?
        </Modal.Description>
      </Modal>

      <Modal
        open={createBeforeAfterOpen}
        fields={{
          title: '',
          description: '',
          barber_id: '',
          service_id: '',
          before_image: null,
          after_image: null,
          display_order: 0,
        }}
        action={{ submit: 'Publish transformation', loading: 'Publishing…' }}
        onSubmit={handleCreateBeforeAfter}
        onClose={() => setCreateBeforeAfterOpen(false)}
      >
        <Modal.Title icon="image">Before & after</Modal.Title>
        <Modal.Description>
          Optional: publish client-approved transformation images and link them to a barber or service.
        </Modal.Description>
        <Input label="Title" type="text" name="title" required maxLength={100} size="md" />
        <Input label="Description" type="text" name="description" maxLength={240} size="md" />
        <Input label="Barber (optional)" type="dropdown" name="barber_id" fetcher={barberOptions} size="md" />
        <Input
          label="Service (optional)"
          type="dropdown"
          name="service_id"
          fetcher={async () =>
            services.map((service) => ({ key: service.id, value: `${service.name} · ${service.barber_name}` }))
          }
          size="md"
        />
        <Input label="Before image" type="file" name="before_image" accept="image/*" required placeholder="Choose before photo" />
        <Input label="After image" type="file" name="after_image" accept="image/*" required placeholder="Choose after photo" />
        <Input label="Display order" type="number" name="display_order" min="0" size="md" />
      </Modal>

      <Modal
        open={Boolean(deleteBeforeAfter)}
        action={{ submit: 'Delete transformation', loading: 'Deleting…' }}
        onSubmit={handleDeleteBeforeAfter}
        onClose={() => setDeleteBeforeAfter(null)}
      >
        <Modal.Title icon="warning">Delete transformation</Modal.Title>
        <Modal.Description>
          Remove <strong>{deleteBeforeAfter?.title}</strong> from public view?
        </Modal.Description>
      </Modal>
    </div>
  );
}

export default AdminCatalog;

import { useTranslation } from '../contexts/I18nContext';
import { MapPin, Phone, Clock, Navigation, Truck } from 'lucide-react';

export default function HospitalCard({ hospital, onBookAmbulance }) {
  const { t } = useTranslation();

  return (
    <div className="card min-w-[calc(100%-32px)] max-w-[360px] snap-center flex-shrink-0">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
          <MapPin size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="font-body font-semibold text-lg text-text-primary">{hospital.name}</h3>
          <p className="text-text-secondary text-sm">{hospital.distance} {t('hospitals.km_away')}</p>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-text-secondary text-base">
          <MapPin size={16} />
          <span>{hospital.address}</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary text-base">
          <Phone size={16} />
          <span>{hospital.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary text-base">
          <Clock size={16} />
          <span>{hospital.hours || t('hospitals.emergency_24_7')}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center justify-center gap-2 text-center"
        >
          <Navigation size={16} />
          {t('hospitals.get_directions')}
        </a>
        <button
          onClick={() => onBookAmbulance?.(hospital)}
          className="btn-danger flex items-center justify-center gap-2 rounded-full"
        >
          <Truck size={16} />
          {t('hospitals.book_ambulance')}
        </button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { COUNTRY_CODES, getPhoneError, getPhoneMaxLength } from '../../utils/clientValidation';

const PhoneInput = ({
  phone = '',
  countryCode = '+1',
  onPhoneChange,
  onCountryCodeChange,
  label = 'Phone',
  placeholder = 'Phone number',
  required = false,
  showValidation = true,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  const filteredCodes = search
    ? COUNTRY_CODES.filter(
        (c) =>
          c.country.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search) ||
          c.label.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRY_CODES;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setShowDropdown(false);
        setSearch('');
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const phoneError = showValidation ? getPhoneError(phone, countryCode) : '';

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className="relative flex border border-gray-200 rounded-xl overflow-visible"
        ref={ref}
      >
        <button
          type="button"
          onClick={() => { setShowDropdown((prev) => !prev); setSearch(''); }}
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-r border-gray-200 hover:bg-gray-100 transition-colors shrink-0"
        >
          <img
            src={`https://flagcdn.com/w40/${selectedCountry.country.toLowerCase()}.png`}
            alt={selectedCountry.country}
            className="w-6 h-4 object-cover rounded-[2px]"
          />
          <span className="text-sm text-gray-700">({selectedCountry.label.split(' ')[1]})</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
        <input
          type="tel"
          placeholder={placeholder}
          value={phone}
          onChange={(e) => {
            const val = e.target.value.replace(/[^\d]/g, '');
            const max = getPhoneMaxLength(countryCode);
            if (val.length <= max) {
              onPhoneChange(val);
            }
          }}
          className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none border-none focus:ring-0"
        />
        {showDropdown && (
          <div className="absolute left-0 top-full z-20 w-56 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {filteredCodes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No results</p>
              ) : (
                filteredCodes.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onCountryCodeChange(c.code);
                      setShowDropdown(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${countryCode === c.code ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                  >
                    <img
                      src={`https://flagcdn.com/w40/${c.country.toLowerCase()}.png`}
                      alt={c.country}
                      className="w-6 h-4 object-cover rounded-[2px] shrink-0"
                    />
                    <span className="font-medium">{c.country}</span>
                    <span className="text-gray-400 ml-auto">({c.label.split(' ')[1]})</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {phoneError && (
        <p className="text-xs text-red-500 mt-1">{phoneError}</p>
      )}
    </div>
  );
};

export default PhoneInput;

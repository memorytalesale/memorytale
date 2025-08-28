import React from 'react';
import { CreditCard, Eye } from 'lucide-react';
import { UserData } from '../types/tale';

interface BookPreviewProps {
  userData: UserData;
  onPayment: () => void;
  previewData?: any; // Datos de preview que vienen de Make
}

export function BookPreview({ userData, onPayment, previewData }: BookPreviewProps) {
  const isStyleA = userData['estilo-libro'] === 'estiloa';
  
  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
      <h3 className="font-semibold text-gray-800 text-center flex items-center justify-center space-x-2">
        <Eye className="w-4 h-4" />
        <span>Vista previa de tu libro</span>
      </h3>
      
      {/* Book Preview */}
      <div className="relative mx-auto w-full max-w-md">
        {previewData?.previewImageUrl ? (
          <img
            src={previewData.previewImageUrl}
            alt="Vista previa del libro"
            className="w-full h-auto rounded-xl shadow-xl border border-gray-200"
            loading="eager"
            decoding="async"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          // Fallback: tu mockup 3D actual
          <div className="relative mx-auto w-48 h-64 perspective-1000">
            <div className="w-full h-full transform-style-preserve-3d hover:rotate-y-12 transition-transform duration-500">
              <div
                className={`absolute inset-0 rounded-lg shadow-xl ${
                  (userData['estilo-libro'] === 'estiloa')
                    ? 'bg-gradient-to-br from-rose-400 to-pink-500'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}
              >
                <div className="p-4 h-full flex flex-col justify-between text-white">
                  <div>
                    <h4 className="text-lg font-bold leading-tight">
                      {userData['nombre-destinatario'] ? `Para ${userData['nombre-destinatario']}` : 'Tu Historia'}
                    </h4>
                    <p className="text-sm opacity-90 mt-1">Una historia única</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-75">
                      {userData['user-name'] ? `Por ${userData['user-name']}` : 'Con amor'}
                    </p>
                  </div>
                </div>
              </div>
              {/* Book spine */}
              <div
                className={`absolute top-0 right-0 w-2 h-full ${
                  (userData['estilo-libro'] === 'estiloa') ? 'bg-rose-600' : 'bg-blue-700'
                } rounded-r-lg`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Extracto: solo si NO hay imagen o si el overlay NO se dibujó */}
      {(!previewData?.previewImageUrl || previewData?.overlayTextRendered === false) && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-800 mb-2">Extracto de tu historia:</h4>
          <p className="text-sm text-gray-600 italic leading-relaxed">
            {previewData?.previewText ? (
              `"${previewData.previewText}"`
            ) : (
              `"Esta es la historia de ${userData['nombre-destinatario'] || '[nombre]'}, contada con todo el amor de ${userData['user-name'] || '[tu nombre]'}. Una historia única que captura los momentos más especiales de vuestra relación..."`
            )}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">24,90€</div>
          <div className="text-sm text-gray-500">PDF personalizado en 15 minutos</div>
        </div>
        
        <button
          onClick={onPayment}
          className="mt-buy-btn w-full"
        >
          <CreditCard className="w-4 h-4" />
          <span>¡Quiero comprarlo!</span>
        </button>
        
        {/* Beneficios de compra (inline, sin viñetas) */}
        <div className="purchase-benefits" aria-label="Ventajas de la compra">
          <span>PDF instantáneo</span>
          <span>Pago seguro</span>
          <span>Garantía 100%</span>
        </div>
      </div>
    </div>
  );
}
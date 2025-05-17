document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('form-modal');
    // Si viene desde otra página con #abrir-formulario, abre el modal automáticamente
  if (window.location.hash === "#abrir-formulario") {
    setTimeout(() => {
      if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
      }
    }, 300);
  }
  const createBookBtn = document.getElementById('create-book-btn');
  const createBookBtnHeader = document.getElementById('create-book-btn-header');
  const closeModal = document.querySelector('.close-modal');
  const bookForm = document.getElementById('book-form');
  const nextButtons = document.querySelectorAll('.next-btn');
  const backButtons = document.querySelectorAll('.back-btn');
  const recipientOptions = document.querySelectorAll('.recipient-option');
  const progressTitle = document.getElementById('progress-title');
  let currentStep = 0;
  let selectedRecipient = '';

  const formSteps = Array.from(document.querySelectorAll('.form-step'));

  createBookBtn?.addEventListener('click', openModal);
  createBookBtnHeader?.addEventListener('click', openModal);
  closeModal?.addEventListener('click', closeModalFunc);
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeModalFunc();
  });

  function openModal() {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closeModalFunc() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  function updateStep(newIndex) {
    formSteps[currentStep].classList.remove('active');
    currentStep = newIndex;
    formSteps[currentStep].classList.add('active');

    if (currentStep === 0) {
      progressTitle.classList.remove('hidden');
      progressTitle.textContent = 'Crea tu libro personalizado';
    } else {
      progressTitle.classList.add('hidden');
      progressTitle.textContent = '';
    }

    updateProgress();
    document.querySelector('.modal-content').scrollTop = 0;
  }

  function updateProgress() {
    const step = formSteps[currentStep];
    if (step.dataset && step.dataset.recipient && step.dataset.step) {
      const questionIndex = step.dataset.step;
      const total = formSteps.filter(s => s.dataset.recipient === selectedRecipient).length;
      progressTitle.innerHTML = `Pregunta ${questionIndex} de ${total}`;
    } else {
      progressTitle.innerHTML = 'Crea tu libro personalizado';
    }
  }

  function getRecipientLabel(recipient) {
    return {
      partner: 'Tu pareja',
      child: 'Tu hijo/a',
      parent: 'Tu padre/madre',
      sibling: 'Tu hermano/a'
    }[recipient] || '';
  }

  recipientOptions.forEach(option => {
    option.addEventListener('click', () => {
      recipientOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');

      selectedRecipient = option.dataset.recipient;
      document.getElementById('tipo-input').value = selectedRecipient;

      document.getElementById('summary-recipient').textContent =
        getRecipientLabel(selectedRecipient);

      const nameStepIndex = formSteps.findIndex(step => step.id === 'recipient-name');

      setTimeout(() => {
        updateStep(nameStepIndex);
        formSteps[nameStepIndex]
          .querySelector('#nombre-destinatario')
          ?.focus();
      }, 150);
    });
  });

  // Microinteracción del nombre
  const nombreInput = document.getElementById('nombre-destinatario');
  const preview = document.getElementById('preview-nombre');

  if (nombreInput && preview) {
    nombreInput.addEventListener('input', () => {
      const value = nombreInput.value.trim();
      if (value.length > 0) {
        preview.style.display = 'block';
        preview.innerHTML = `Así hablaremos de <strong>${value}</strong> a lo largo de tu historia.`;
      } else {
        preview.style.display = 'none';
        preview.innerHTML = '';
      }
    });
  }

  nextButtons.forEach(button => {
    button.addEventListener('click', () => {
      const currentElement = formSteps[currentStep];

      const isFinalStep =
        currentElement.dataset.recipient === selectedRecipient &&
        currentElement.dataset.step === '8';

      if (isFinalStep) {
        const summaryIndex = formSteps.findIndex(s => s.id === 'form-summary');
        updateStep(summaryIndex);
        return;
      }

      for (let i = currentStep + 1; i < formSteps.length; i++) {
        const step = formSteps[i];
        const isMatch = !step.dataset.recipient || step.dataset.recipient === selectedRecipient;

        if (isMatch) {
          updateStep(i);
          return;
        }
      }

      const fallback = formSteps.findIndex(s => s.id === 'form-summary');
      if (fallback !== -1) updateStep(fallback);
    });
  });

  backButtons.forEach(button => {
    button.addEventListener('click', () => {
      const currentElement = formSteps[currentStep];
      const isFirstOfBlock =
        currentElement.dataset.recipient === selectedRecipient &&
        currentElement.dataset.step === '1';

      if (isFirstOfBlock) {
        const selectionIndex = formSteps.findIndex(step => step.id === 'recipient-selection');
        updateStep(selectionIndex);
      } else {
        updateStep(currentStep - 1);
      }
    });
  });

  bookForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(bookForm);
    const jsonData = {};
    formData.forEach((value, key) => {
      jsonData[key] = value;
    });

    updateStep(formSteps.findIndex(s => s.id === 'processing'));

    fetch('https://hook.eu2.make.com/bamawr2rpu3liznhi5l7g8u4849hfob5', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jsonData)
    })
      .then(response => {
        if (!response.ok) throw new Error('Error al enviar');
        setTimeout(() => {
          updateStep(formSteps.findIndex(s => s.id === 'preview'));
        }, 3000);
      })
      .catch(error => {
        console.error('Error al enviar el formulario:', error);
        document.getElementById('submission-error').style.display = 'block';
      });
  });

  // FAQ toggle
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      faqItems.forEach(faq => faq.classList.remove('active'));
      item.classList.toggle('active');
    });
  });

  // Animaciones al hacer scroll
  const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });
  function handleIntersection(entries, obs) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = 1;
        obs.unobserve(entry.target);
      }
    });
  }
  // Evita que el teclado tape los inputs en móviles
const allInputs = document.querySelectorAll('input, textarea');
allInputs.forEach(input => {
  input.addEventListener('focus', () => {
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });
});

  document.querySelectorAll('.step, .example, .testimonial, .price-card')
    .forEach(el => observer.observe(el));
    
});// ← Cierre de document.addEventListener('DOMContentLoaded', …
 document.querySelectorAll('.open-formulario').forEach(card => {
  card.addEventListener('click', function (e) {
    e.preventDefault();
    const modal = document.getElementById('form-modal');
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  });
});


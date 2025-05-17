<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';

$mail = new PHPMailer(true);

try {
    // Cargar variables del archivo .env
    $env = parse_ini_file(__DIR__ . '/../.env');

    // Configuración del servidor SMTP
    $mail->isSMTP();
    $mail->Host       = $env['SMTP_HOST'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $env['SMTP_USER_EMBAJADOR'];
    $mail->Password   = $env['SMTP_PASS_EMBAJADOR'];
    $mail->SMTPSecure = $env['SMTP_SECURE'];
    $mail->Port       = $env['SMTP_PORT'];

    // Aquí va el resto de la lógica de envío del formulario...
    // $mail->setFrom(...);
    // $mail->addAddress(...);
    // $mail->Subject = "...";
    // $mail->Body    = "...";

    // $mail->send();
    echo 'Mensaje enviado correctamente';

} catch (Exception $e) {
    echo 'Error al enviar el mensaje: ', $mail->ErrorInfo;
}
?>

from django.core.management.base import BaseCommand, CommandError

from api.models import Admin


class Command(BaseCommand):
    help = (
        'Link an existing Firebase Authentication user (already created in the Firebase console) '
        'to a Django Admin account, so it can sign in via the "Sign in with email" staff option. '
        'Never touches the Django password of an existing account.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='Email of the Firebase user (also stored on the Admin).')
        parser.add_argument('--firebase-uid', required=True, help='The Firebase Authentication UID to link.')
        parser.add_argument(
            '--username',
            help='Django username for the account. Defaults to the local part of --email.',
        )

    def handle(self, *args, **options):
        email = options['email'].strip()
        firebase_uid = options['firebase_uid'].strip()
        username = (options.get('username') or email.split('@', 1)[0]).strip()

        if not email or not firebase_uid:
            raise CommandError('--email and --firebase-uid are both required.')

        existing_uid_owner = Admin.objects.filter(firebase_uid=firebase_uid).exclude(username=username).first()
        if existing_uid_owner:
            raise CommandError(f'firebase_uid is already linked to a different account: {existing_uid_owner.username}')

        admin = Admin.objects.filter(username=username).first()
        if admin:
            admin.email = email
            admin.firebase_uid = firebase_uid
            admin.save(update_fields=['email', 'firebase_uid'])
            self.stdout.write(self.style.SUCCESS(f'Linked existing administrator {username} to Firebase UID {firebase_uid}.'))
        else:
            admin = Admin(username=username, email=email, firebase_uid=firebase_uid, is_active=True)
            admin.set_unusable_password()  # sign-in for this account happens via Firebase, not Django password
            admin.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Created administrator {username} (email={email}) linked to Firebase UID {firebase_uid}. '
                    'It has no Django password — it can only sign in via "Sign in with email".'
                )
            )

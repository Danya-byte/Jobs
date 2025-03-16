from telethon.sync import TelegramClient
from telethon.events import NewMessage
import asyncio

api_id = 28881280
api_hash = '7cb12650ea0b73a36fec5e27d3c8964f'
phone = '+88804935469'
target_user_id = 1871247390  # ID пользователя, на чьи сообщения отвечать

client = TelegramClient('session_name', api_id, api_hash)

@client.on(NewMessage(incoming=True, chats=None))
async def handler(event):
    my_id = (await client.get_me()).id
    # Проверяем, что сообщение пришло в ЛС, не от тебя и от нужного пользователя
    if not event.is_group and event.sender_id != my_id and event.sender_id == target_user_id:
        try:
            await event.reply('РСТМ ПИДОР')
            print(f'Ответ отправлен в ЛС пользователю с ID: {event.sender_id}')
            await asyncio.sleep(1)
        except Exception as e:
            print(f'Ошибка при отправке ответа в ЛС пользователю с ID: {event.sender_id}. Ошибка: {e}')

async def main():
    await client.start(phone)
    print(f'Клиент запущен. Ожидание сообщений в ЛС от пользователя с ID {target_user_id}...')
    await client.run_until_disconnected()

if __name__ == '__main__':
    client.loop.run_until_complete(main())
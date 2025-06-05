// HelpPage.tsx
import React, { useState } from 'react';
import './styles/HelpPage.css';
import { FaRocket, FaSearch, FaHeart, FaUserCircle, FaBug, FaPlusCircle, FaQuestionCircle, FaChevronDown } from 'react-icons/fa';

const sections = [
	{
		title: 'Getting Started',
		icon: <FaRocket color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Unbox your LiquorBot and connect it to power. Ensure the device is turned on.',
			'Open the LiquorBot app and navigate to “Device Settings” to pair your LiquorBot via Bluetooth or Wi‑Fi.',
			'Assign ingredients to the LiquorBot slots in “Device Settings.” Use the ingredient list to map each slot correctly.',
			'Tap “Explore Drinks” on the home screen to browse the menu or create your own custom drink.',
			'To create a custom drink, tap the “+” button in the “My Drinks” section and follow the steps to add ingredients and design your drink.',
			'Once your LiquorBot is connected and ingredients are loaded, select a drink and tap “Pour Drink” to start pouring.',
			'Check the connection status at the top of the app to ensure your LiquorBot is ready to use.',
		],
	},
	{
		title: 'Browsing & Finding Drinks',
		icon: <FaSearch color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Use the search bar to filter drinks by name or ingredient.',
			'Swipe the category chips to jump to specific categories like Vodka, Rum, or Tequila.',
			'Toggle the funnel icon to access advanced filters.',
			'"Only show drinks I can make" limits the list to drinks you can prepare with your current ingredients.',
			'"Sort alphabetically" organizes drinks by name.',
			'"Only show my custom drinks" displays only your personalized recipes.',
			'Custom drinks are seamlessly integrated into the menu and can be edited by tapping the pencil icon on their expanded card.',
			'Pour drinks directly from the app by tapping "Pour Drink" on an expanded card. Ensure your LiquorBot is connected and has the required ingredients loaded.',
			'Every successful pour is logged in your history for future reference.',
		],
	},
	{
		title: 'Favorites & History',
		icon: <FaHeart color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Tap the heart icon on any drink card to like or unlike a drink.',
			'View all your liked drinks in the “Liked Drinks” section of your profile.',
			'Liked drinks include both built-in recipes and your custom creations.',
			'Pour history is automatically saved locally and includes details like drink name, volume, and timestamp.',
			'Access your pour history in the “History” section of your profile.',
			'To reset your pour history, navigate to Profile Settings and select Clear History.',
			'Liked drinks and history are synced with your account, so they persist across devices.',
		],
	},
	{
		title: 'Creating a Recipe',
		icon: <FaPlusCircle color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Tap the “+” button in the “My Drinks” section to start creating a new recipe.',
			'Enter a unique name for your drink. Duplicate names are not recommended.',
			'Add ingredients by selecting them from the list. You can filter by category or search by name.',
			'Specify the volume for each ingredient and set its priority to control the pour order.',
			'Use the “Build Image” tool to design a custom drink image by selecting a glass type, drink color, and garnish.',
			'Save your recipe to make it available in the menu and for pouring.',
			'Edit or delete your custom recipes anytime from the “My Drinks” section.',
		],
	},
	{
		title: 'Profile & Social',
		icon: <FaUserCircle color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Edit your profile details, including first name, last name, and bio, from the “Edit Profile” section.',
			'Tap the profile picture to upload a new image. Supported formats include JPG and PNG.',
			'Your username is permanent and cannot be changed after registration.',
			'Your bio can be up to 100 characters and is visible to others in future social features.',
		],
	},
	{
		title: 'Troubleshooting',
		icon: <FaBug color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Can’t connect? Hold the LiquorBot power button for 5 seconds to reset Bluetooth or Wi‑Fi settings.',
			'Ensure your phone’s Bluetooth or Wi‑Fi is enabled and the LiquorBot is powered on.',
			'If the app cannot find your LiquorBot, try restarting both the device and the app.',
			'Drinks won’t pour? Verify that the tubing is primed and the ingredient slots are correctly mapped in “Device Settings.”',
			'Check the ingredient levels to ensure there is enough liquid in the containers.',
			'App stuck on loading? Force-quit the app and reopen it. Your state is auto-saved in the cloud.',
			'If the issue persists, clear the app cache from your phone’s settings and log back in.',
			'For hardware issues, contact support at support@liquorbot.io or visit our full documentation for advanced troubleshooting steps.',
		],
	},
	{
		title: 'Frequently Asked Questions',
		icon: <FaQuestionCircle color="#CE975E" style={{ marginRight: 8 }} />,
		items: [
			'Q: Can I use LiquorBot without an internet connection?\nA: Yes, LiquorBot works over Bluetooth for local control. However, some features like syncing custom recipes require internet access.',
			'Q: How do I clean my LiquorBot?\nA: Run warm water through the tubing using the “Clean” option in Device Settings. Refer to the full documentation for detailed cleaning instructions.',
			'Q: Can I share my custom recipes with friends?\nA: Not yet, but this feature is coming soon in a future update!',
			'Q: What happens if I lose my connection during a pour?\nA: No worries the pour will still complete automatically! Just make sure to reconnect.',
			'Q: How do I reset my LiquorBot to factory settings?\nA: Hold the power button for 10 seconds until the LED blinks red. This will reset all settings, including slot mappings.',
			'Q: Is my data synced across devices?\nA: Yes, your liked drinks, custom recipes, and pour history are synced to your account and accessible on any device.',
			'Q: Can I use non-alcoholic ingredients?\nA: Absolutely! LiquorBot supports mixers, juices, and other non-alcoholic ingredients.',
		],
	},
];

function AccordionSection({ title, icon, items, open, onClick }: any) {
	return (
		<div className="help-section">
			<div
				className={`help-sec-header${open ? ' open' : ''}`}
				onClick={onClick}
				tabIndex={0}
				role="button"
				aria-expanded={open}
			>
				{icon}
				<span className="help-sec-title">{title}</span>
				<span className="help-sec-chevron">
					<FaChevronDown />
				</span>
			</div>
			{open && (
				<div className="help-sec-body">
					{items.map((txt: string, i: number) => (
						<div className="help-bullet-row" key={i}>
							<span className="help-bullet">●</span>
							<span className="help-bullet-text">{txt}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

const HelpPage: React.FC = () => {
	const [openIdx, setOpenIdx] = useState<number | null>(0);
	return (
		<div className="help-page-wrapper" style={{ padding: '2.2rem 1.2rem', boxSizing: 'border-box' }}>
			<div className="help-title">LiquorBot Help&nbsp;Center</div>
			<div className="help-divider" />
			{sections.map((s, i) => (
				<AccordionSection
					key={s.title}
					{...s}
					open={openIdx === i}
					onClick={() => setOpenIdx(openIdx === i ? null : i)}
				/>
			))}
			<div className="help-footer">
				Need more help? Check our{' '}
				<a className="help-link" href="/docs" target="_blank" rel="noopener noreferrer">full documentation</a>
				{' '}or email{' '}
				<a className="help-link" href="mailto:support@liquorbot.io">support@liquorbot.io</a>.
			</div>
		</div>
	);
};

export default HelpPage;

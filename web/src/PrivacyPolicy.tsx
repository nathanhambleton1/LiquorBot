import React, { useState } from 'react';

const policySections = [
	{
		title: '1. Information We Collect',
		content: (
			<ul>
				<li>
					<strong>Name & Email Address</strong> – We collect your name and email
					address when you create an account or contact support. This information is
					used for account management, communication, and product personalization.
				</li>
				<li>
					<strong>Photos or Videos</strong> – If you upload a profile photo or share
					drink images, these are stored and linked to your account for
					personalization and sharing features.
				</li>
				<li>
					<strong>Identifiers</strong> – We collect your Cognito user ID and device
					IDs to uniquely identify your account and devices, and to enable secure
					access and analytics.
				</li>
				<li>
					<strong>User Content</strong> – This includes custom drink recipes, drink
					images, pour history, liked drinks, and event participation details.
					User content is stored to provide app functionality and personalization.
				</li>
				<li>
					<strong>Product Interaction Data</strong> – We collect data about your
					interactions with the app, such as taps, screen views, drink‑pour commands,
					and other in‑app actions. This is used for analytics and to improve app
					functionality.
				</li>
				<li>
					<strong>Diagnostics</strong> – Crash logs, performance metrics, and error
					reports are collected to maintain and improve app stability and
					performance.
				</li>
			</ul>
		),
	},
	{
		title: '2. How We Use Your Information',
		content: (
			<ul>
				<li>
					To authenticate and manage user accounts, including sign-in and security.
				</li>
				<li>
					To enable Bluetooth and Wi‑Fi connectivity with LiquorBot dispensers and
					manage device pairing.
				</li>
				<li>
					To store and display your custom drinks, pour history, and event data
					within the app.
				</li>
				<li>
					To personalize your experience, such as showing your profile photo, custom
					drinks, and event participation.
				</li>
				<li>To provide customer support and respond to your inquiries or requests.</li>
				<li>
					To analyze product interaction and usage data for improving app features,
					stability, and performance.
				</li>
				<li>
					To maintain the security and integrity of our services, including fraud
					prevention and account protection.
				</li>
				<li>
					To send you essential communications related to your account or app
					updates. You may opt out of non-essential emails.
				</li>
			</ul>
		),
	},
	{
		title: '3. Data Linked to You',
		content: (
			<ul>
				<li>
					All data types listed above (Name, Email Address, Photos or Videos, User
					ID, Device ID, Product Interaction, Crash Data, Performance Data) are
					linked to your identity for the purposes described in this policy.
				</li>
				<li>We do not sell or rent your personal data to third parties.</li>
			</ul>
		),
	},
	{
		title: '4. Legal Bases for Processing (EEA/UK Users)',
		content: (
			<ul>
				<li>
					<strong>Contractual Necessity</strong> – To provide the services you
					request, such as account creation and device connectivity.
				</li>
				<li>
					<strong>Legitimate Interests</strong> – For improving, securing, and
					personalizing the app, and for analytics.
				</li>
				<li>
					<strong>Consent</strong> – Where required for optional features (e.g.,
					updating a profile photo or sharing content).
				</li>
				<li>
					<strong>Legal Compliance</strong> – When required to comply with
					applicable laws or legal processes.
				</li>
			</ul>
		),
	},
	{
		title: '5. Sharing of Your Information',
		content: (
			<ul>
				<li>
					<strong>AWS Cloud Services</strong> – Your data is stored and processed in
					Amazon Web Services (Cognito, S3, AppSync, and related infrastructure) in
					the United States or other jurisdictions.
				</li>
				<li>
					<strong>Service Providers</strong> – Trusted vendors help us with
					analytics, crash reporting, or email support and are bound by
					confidentiality obligations. Examples include AWS, analytics providers, and
					email services.
				</li>
				<li>
					<strong>Legal Compliance</strong> – We may disclose your information when
					required to comply with laws, regulations, or legal processes.
				</li>
				<li>
					<strong>Business Transfers</strong> – In connection with a merger,
					acquisition, or asset sale, your information may be transferred as part of
					the transaction.
				</li>
			</ul>
		),
	},
	{
		title: '6. Data Retention',
		content: (
			<ul>
				<li>
					We retain your information only as long as necessary to fulfill the
					purposes outlined in this Policy, comply with our legal obligations,
					resolve disputes, and enforce our agreements.
				</li>
				<li>
					When you delete your account or request deletion, we remove your personal
					data from our systems, except where retention is required by law.
				</li>
				<li>
					Some anonymized or aggregated data may be retained for analytics and
					service improvement.
				</li>
			</ul>
		),
	},
	{
		title: '7. Your Choices & Rights',
		content: (
			<ul>
				<li>
					<strong>Profile Management</strong> – You can review and update your
					profile information within the app at any time.
				</li>
				<li>
					<strong>Email Communications</strong> – You may opt out of non‑essential
					emails by following the unsubscribe instructions in those emails.
				</li>
				<li>
					<strong>Data Access & Deletion</strong> – You may request a copy of your
					data or deletion of your account by emailing us at{' '}
					<a href="mailto:nhambleton03@gmail.com">nhambleton03@gmail.com</a>. We
					will respond to your request in accordance with applicable laws.
				</li>
				<li>
					<strong>Device Permissions</strong> – You can revoke Bluetooth, camera,
					or photo‑library permissions at any time via your device settings. Some
					features may not work without these permissions.
				</li>
				<li>
					<strong>App Store Privacy Choices</strong> – You may review and manage your
					privacy choices via your device’s app store privacy settings.
				</li>
			</ul>
		),
	},
	{
		title: '8. Security',
		content: (
			<ul>
				<li>
					We use industry‑standard security measures, including HTTPS/TLS encryption,
					AWS IAM policies, and access controls to protect your data.
				</li>
				<li>
					We regularly review our security practices and update them as needed to
					address new threats.
				</li>
				<li>
					No system is 100% secure, so we cannot guarantee absolute security. Please
					use strong passwords and protect your account credentials.
				</li>
			</ul>
		),
	},
	{
		title: '9. Children’s Privacy',
		content: (
			<ul>
				<li>
					The app is not directed to individuals under the age of 17. We do not
					knowingly collect personal information from children.
				</li>
				<li>
					If you become aware that a child has provided us with personal data,
					please contact us and we will take steps to delete such information.
				</li>
			</ul>
		),
	},
	{
		title: '10. International Transfers',
		content: (
			<ul>
				<li>
					Your information may be processed and stored in the United States or other
					jurisdictions where AWS or our service providers operate.
				</li>
				<li>
					We rely on standard contractual clauses or other lawful mechanisms for such
					transfers, as required by applicable law.
				</li>
			</ul>
		),
	},
	{
		title: '11. Changes to This Policy',
		content: (
			<ul>
				<li>
					We may update this Privacy Policy periodically to reflect changes in our
					practices or legal requirements.
				</li>
				<li>
					We will post the updated version in-app and, if the changes are
					significant, provide a more prominent notice or request your consent as
					required by law.
				</li>
				<li>
					We encourage you to review this policy regularly to stay informed about our
					privacy practices.
				</li>
			</ul>
		),
	},
	{
		title: '12. Contact Us',
		content: (
			<div>
				<p>
					If you have questions, concerns, or requests regarding this Privacy Policy
					or your data, please contact us:
				</p>
				<p>
					Email:{' '}
					<a href="mailto:nhambleton03@gmail.com">nhambleton03@gmail.com</a>
				</p>
				<p>
					Privacy Policy URL:{' '}
					<a
						href="https://liquorbot-storage-8cb6bcd8a9244-dev.s3.us-east-1.amazonaws.com/public/privacyPolicy.html"
						target="_blank"
						rel="noopener noreferrer"
					>
						View Online
					</a>
				</p>
			</div>
		),
	},
];

const PrivacyPolicy: React.FC = () => {
	const [openSections, setOpenSections] = useState<number[]>([0]); // First section open by default

	const toggleSection = (idx: number) => {
		setOpenSections((prev) =>
			prev.includes(idx)
				? prev.filter((i) => i !== idx)
				: [...prev, idx]
		);
	};

	return (
		<div
			className="lb-container"
			style={{
				padding: '3rem 0',
				maxWidth: 700,
				margin: '0 auto',
				minHeight: '60vh',
			}}
		>
			<h1 style={{ marginBottom: 0, color: '#fff' }}>LiquorBot Privacy Policy</h1>
			<div
				style={{
					color: '#cecece',
					marginBottom: '2.5rem',
					fontSize: '1.1rem',
				}}
			>
				<strong>Effective Date:</strong> May 29, 2025
			</div>
			<div className="policy-sections">
				{policySections.map((section, idx) => (
					<div
						key={section.title}
						className="policy-section"
						style={{
							marginBottom: 18,
							borderRadius: 8,
							background: '#181818',
							boxShadow: '0 1px 6px #0002',
						}}
					>
						<button
							className="policy-toggle"
							onClick={() => toggleSection(idx)}
							aria-expanded={openSections.includes(idx)}
							style={{
								width: '100%',
								textAlign: 'left',
								background: 'none',
								border: 'none',
								padding: '1.1rem 1.2rem',
								fontSize: '1.13rem',
								fontWeight: 600,
								color: '#fff', // Section title text white
								cursor: 'pointer',
								borderBottom: openSections.includes(idx)
									? '1px solid #333'
									: 'none',
								outline: 'none',
								display: 'flex',
								alignItems: 'center',
								gap: 10,
								borderRadius: 8,
								transition: 'background 0.15s',
							}}
						>
							<span
								style={{
									fontSize: 32, // Increased chevron size
									transition: 'transform 0.28s cubic-bezier(.4,2,.6,1)',
									display: 'inline-block',
									width: 32,
									textAlign: 'center',
									transform: openSections.includes(idx) ? 'rotate(90deg)' : 'rotate(0deg)',
									color: '#ce975e', // Chevron gold
								}}
							>
								›
							</span>
							{section.title}
						</button>
						{openSections.includes(idx) && (
							<div
								style={{
									padding: '1.1rem 2.2rem 1.2rem 2.7rem',
									color: '#eaeaea',
									fontSize: '1.04rem',
									lineHeight: 1.7,
									transition: 'max-height 0.35s cubic-bezier(.4,2,.6,1), opacity 0.25s',
									maxHeight: openSections.includes(idx) ? 800 : 0,
									opacity: openSections.includes(idx) ? 1 : 0,
									overflow: 'hidden',
								}}
							>
								{section.content}
							</div>
						)}
					</div>
				))}
			</div>
			<div
				style={{
					color: '#888',
					fontSize: '0.98rem',
					marginTop: 32,
					textAlign: 'center',
				}}
			>
				— End of Policy —
			</div>
		</div>
	);
};

export default PrivacyPolicy;
